import { AdminError, adminMessage, errorCodeOf, reasonOf, requireAdmin } from './guards';
import { nextOrder } from './order';

/**
 * CRUD del slider hero (colección `slider`), modelo pre-migración del Django
 * `Slider`: `{title, message, url}` + `link` opcional. El campo `order`
 * (posición) se conserva porque la lectura pública usa `orderBy('order')`.
 */

export interface SlideAdmin {
  id: string;
  title: string;
  message: string;
  url: string;
  link: string;
  /** Posición en el slider (los docs sin `order` quedan fuera de la lectura). */
  order: number;
}

export interface SlideDraft {
  title: string;
  message: string;
  url: string;
  link: string;
}

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const isUrl = (value: string): boolean => /^(https?:\/\/|\/)\S*/i.test(value);

function toSlide(id: string, data: Record<string, unknown>): SlideAdmin {
  return {
    id,
    title: str(data.title),
    message: str(data.message),
    url: str(data.url),
    link: str(data.link),
    order: typeof data.order === 'number' ? data.order : 0,
  };
}

function validate(draft: SlideDraft): void {
  if (!draft.title.trim()) throw new AdminError('La diapositiva necesita un título.');
  if (!isUrl(draft.url.trim())) {
    throw new AdminError('La diapositiva necesita una imagen (URL http/https).');
  }
  if (draft.link.trim() !== '' && !isUrl(draft.link.trim())) {
    throw new AdminError('El enlace debe empezar por http(s):// o /.');
  }
}

/** Diapositivas ordenadas por `order`. Requiere admin. */
export async function listSlides(): Promise<SlideAdmin[]> {
  await requireAdmin();

  const { db } = await import('../firebase');
  const { collection, getDocs, orderBy, query } = await import('firebase/firestore');

  try {
    const target = collection(db, 'slider');
    const ordered = await getDocs(query(target, orderBy('order')));
    const snapshot = ordered.empty ? await getDocs(target) : ordered;
    return snapshot.docs.map((document) => toSlide(document.id, document.data()));
  } catch (error) {
    console.warn('⚠️ listSlides falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible cargar el slider.'));
  }
}

/** Crea una diapositiva al final del orden (`addDoc`). Requiere admin. */
export async function addSlide(draft: SlideDraft): Promise<SlideAdmin> {
  await requireAdmin();
  validate(draft);

  const clean: SlideDraft = {
    title: draft.title.trim(),
    message: draft.message.trim(),
    url: draft.url.trim(),
    link: draft.link.trim(),
  };

  const { db } = await import('../firebase');
  const { addDoc, collection } = await import('firebase/firestore');

  try {
    // Siguiente posición: max(order) + 1 (los docs sin order cuentan como 0).
    const order = await nextOrder('slider');
    const document = await addDoc(collection(db, 'slider'), { ...clean, order });
    return { id: document.id, ...clean, order };
  } catch (error) {
    console.warn('⚠️ addSlide falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible crear la diapositiva.'));
  }
}

/** Actualiza campos de una diapositiva (`updateDoc`). Requiere admin. */
export async function updateSlide(id: string, patch: Partial<SlideDraft>): Promise<void> {
  await requireAdmin();
  if (!id) throw new AdminError('Diapositiva inválida.');

  const clean: Partial<SlideDraft> = {};
  if (patch.title !== undefined) clean.title = patch.title.trim();
  if (patch.message !== undefined) clean.message = patch.message.trim();
  if (patch.url !== undefined) clean.url = patch.url.trim();
  if (patch.link !== undefined) clean.link = patch.link.trim();
  if (Object.keys(clean).length === 0) return;

  validate({ title: clean.title ?? '', message: clean.message ?? '', url: clean.url ?? '', link: clean.link ?? '' });

  const { db } = await import('../firebase');
  const { doc, updateDoc } = await import('firebase/firestore');

  try {
    await updateDoc(doc(db, 'slider', id), clean as Record<string, unknown>);
  } catch (error) {
    console.warn('⚠️ updateSlide falló:', reasonOf(error));
    throw new AdminError(
      errorCodeOf(error) === 'permission-denied'
        ? 'No tienes permisos para editar el slider.'
        : 'No fue posible guardar la diapositiva.',
    );
  }
}

/** Elimina una diapositiva (`deleteDoc`). Requiere admin. */
export async function deleteSlide(id: string): Promise<void> {
  await requireAdmin();
  if (!id) throw new AdminError('Diapositiva inválida.');

  const { db } = await import('../firebase');
  const { deleteDoc, doc } = await import('firebase/firestore');

  try {
    await deleteDoc(doc(db, 'slider', id));
  } catch (error) {
    console.warn('⚠️ deleteSlide falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible eliminar la diapositiva.'));
  }
}
