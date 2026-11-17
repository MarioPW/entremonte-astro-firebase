import type { Cabin } from '../types';
import { AdminError, adminMessage, errorCodeOf, reasonOf, requireAdmin } from './guards';
import { nextOrder } from './order';

/**
 * CRUD de cabañas en Firestore (colección `cabins`).
 *
 * Tarifas duales por cabaña (COP): `priceWeekday` (lun–vie) y `priceWeekend`
 * (fines de semana y festivos). Son **obligatorias** en alta y edición; sin
 * valores por defecto. Las reseñas NO viven aquí: son su propia colección
 * (`reviews`).
 */

/** Catálogo de servicios/amenidades que el admin puede marcar por cabaña. */
export const CABIN_SERVICES = [
  'Cafetera',
  'Parqueadero privado',
  'Malla catamarán',
  'Barra de sonido',
  'WiFi',
  'Jacuzzi climatizado',
  'Desayuno tipo americano',
] as const;

export interface CabinAdmin extends Cabin {
  /** Tarifa entre semana (COP) — `null` → tarifa global. */
  priceWeekday: number | null;
  /** Tarifa fin de semana / festivos (COP) — `null` → tarifa global. */
  priceWeekend: number | null;
}

/** Formulario completo, usado en el alta de cabañas. */
export interface CabinDraft {
  name: string;
  capacity: number;
  description: string;
  available: boolean;
  priceWeekday: number | null;
  priceWeekend: number | null;
  images: string[];
  services: string[];
}

/**
 * Parcial para `updateCabin`: solo se validan y guardan las claves presentes.
 * Así, editar precios/capacidad nunca exige reenviar (ni vaciar) el nombre.
 */
export type CabinPatch = Partial<CabinDraft>;

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const strList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
const priceOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function toCabinAdmin(id: string, data: Record<string, unknown>): CabinAdmin {
  return {
    id: str(data.id, id),
    name: str(data.name, 'Cabaña'),
    capacity: num(data.capacity, 1),
    available: Boolean(data.available),
    description: str(data.description),
    images: strList(data.images),
    services: strList(data.services),
    // Fallback al campo legado `price` de la primera versión del panel.
    priceWeekday: 'priceWeekday' in data ? priceOrNull(data.priceWeekday) : priceOrNull(data.price),
    priceWeekend: priceOrNull(data.priceWeekend),
  };
}

const cleanList = (values: string[]): string[] =>
  values.map((value) => value.trim()).filter((value) => value.length > 0);

function validateName(name: string): void {
  if (!name.trim()) throw new AdminError('La cabaña necesita un nombre.');
}

function validateCapacity(capacity: number): void {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new AdminError('La capacidad debe ser al menos 1 persona.');
  }
}

function validateDescription(description: string): void {
  if (!description.trim()) throw new AdminError('La descripción no puede quedar vacía.');
}

function validatePrice(value: number | null | undefined, label: string): void {
  if (value === undefined || value === null) return;
  if (!Number.isFinite(value)) throw new AdminError(`${label} debe ser un número válido.`);
  if (value < 0) throw new AdminError(`${label} no puede ser negativa.`);
}

function validateImages(images: string[]): void {
  for (const url of cleanList(images)) {
    if (!/^https?:\/\/\S+$/i.test(url)) {
      throw new AdminError(`Imagen inválida: "${url.slice(0, 60)}" no es una URL http(s).`);
    }
  }
}

/** Validación completa (alta de cabaña): las tarifas son obligatorias. */
function validateDraft(draft: CabinDraft): void {
  validateName(draft.name);
  validateCapacity(draft.capacity);
  validateDescription(draft.description);
  if (draft.priceWeekday === null || draft.priceWeekday === undefined) {
    throw new AdminError('La tarifa entre semana es obligatoria.');
  }
  if (draft.priceWeekend === null || draft.priceWeekend === undefined) {
    throw new AdminError('La tarifa de fin de semana / festivos es obligatoria.');
  }
  validatePrice(draft.priceWeekday, 'La tarifa entre semana');
  validatePrice(draft.priceWeekend, 'La tarifa de fin de semana');
  validateImages(draft.images);
}

/** Validación parcial: solo revisa los campos incluidos en el patch.
 *  Las tarifas son obligatorias también al editar (no se admiten vacías). */
function validatePatch(patch: CabinPatch): void {
  if (patch.name !== undefined) validateName(patch.name);
  if (patch.capacity !== undefined) validateCapacity(patch.capacity);
  if (patch.description !== undefined) validateDescription(patch.description);
  if (patch.priceWeekday !== undefined) {
    if (patch.priceWeekday === null) throw new AdminError('La tarifa entre semana es obligatoria.');
    validatePrice(patch.priceWeekday, 'La tarifa entre semana');
  }
  if (patch.priceWeekend !== undefined) {
    if (patch.priceWeekend === null) {
      throw new AdminError('La tarifa de fin de semana / festivos es obligatoria.');
    }
    validatePrice(patch.priceWeekend, 'La tarifa de fin de semana');
  }
  if (patch.images !== undefined) validateImages(patch.images);
}

/** Normaliza un patch: recorta strings y descarta listas con basura. */
function cleanPatch(patch: CabinPatch): CabinPatch {
  const clean: CabinPatch = {};
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.capacity !== undefined) clean.capacity = patch.capacity;
  if (patch.description !== undefined) clean.description = patch.description.trim();
  if (patch.available !== undefined) clean.available = patch.available;
  if (patch.priceWeekday !== undefined) clean.priceWeekday = patch.priceWeekday;
  if (patch.priceWeekend !== undefined) clean.priceWeekend = patch.priceWeekend;
  if (patch.images !== undefined) clean.images = cleanList(patch.images);
  if (patch.services !== undefined) clean.services = cleanList(patch.services);
  return clean;
}

/** Cabañas de Firestore con id de documento. Requiere admin. */
export async function listCabins(): Promise<CabinAdmin[]> {
  await requireAdmin();

  const { db } = await import('../firebase');
  const { collection, getDocs } = await import('firebase/firestore');

  try {
    const snapshot = await getDocs(collection(db, 'cabins'));
    return snapshot.docs.map((document) => toCabinAdmin(document.id, document.data()));
  } catch (error) {
    console.warn('⚠️ listCabins falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible cargar las cabañas.'));
  }
}

/**
 * Actualiza campos de una cabaña (`updateDoc`). Requiere admin.
 * Solo valida lo que viene en el patch (p. ej. cambiar la tarifa no exige
 * tocar el nombre → no dispara el error "necesita un nombre").
 */
export async function updateCabin(id: string, patch: CabinPatch): Promise<void> {
  await requireAdmin();
  if (!id) throw new AdminError('Cabaña inválida.');
  if (Object.keys(patch).length === 0) return;

  validatePatch(patch);
  const clean = cleanPatch(patch);
  if (Object.keys(clean).length === 0) return;

  const { db } = await import('../firebase');
  const { doc, updateDoc } = await import('firebase/firestore');

  try {
    await updateDoc(doc(db, 'cabins', id), clean as Record<string, unknown>);
  } catch (error) {
    console.warn('⚠️ updateCabin falló:', reasonOf(error));
    throw new AdminError(
      errorCodeOf(error) === 'permission-denied'
        ? 'No tienes permisos para editar cabañas.'
        : 'No fue posible guardar los cambios.',
    );
  }
}

/** Crea una cabaña nueva con id automático (`setDoc`). Requiere admin. */
export async function addCabin(draft: CabinDraft): Promise<string> {
  await requireAdmin();
  validateDraft(draft);

  const { db } = await import('../firebase');
  const { collection, doc, setDoc } = await import('firebase/firestore');

  try {
    const reference = doc(collection(db, 'cabins'));
    await setDoc(reference, {
      id: reference.id,
      name: draft.name.trim(),
      capacity: draft.capacity,
      description: draft.description.trim(),
      available: draft.available,
      priceWeekday: draft.priceWeekday,
      priceWeekend: draft.priceWeekend,
      images: cleanList(draft.images),
      services: cleanList(draft.services),
      // Requerido por la lectura pública `orderBy('order')` (ver `order.ts`).
      order: await nextOrder('cabins'),
    });
    return reference.id;
  } catch (error) {
    console.warn('⚠️ addCabin falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible crear la cabaña.'));
  }
}
