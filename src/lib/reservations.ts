import type { Timestamp } from 'firebase/firestore';
import { isAdmin } from './auth';

/**
 * Reservas en Firestore (`reservations`), en reemplazo de
 * `POST /api/reservations/` del Django REST en Render.
 *
 * Escritura: usuario autenticado + validación básica → doc con `status`
 * "pending", `uid` y `created_at: serverTimestamp()`.
 * Lectura: solo administradores, ordenada por creación descendente.
 *
 * La seguridad real vive en las reglas de Firestore; aquí hay defensa en capas.
 */

export interface ReservationInput {
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  user_phone: string;
}

export interface ReservationRecord extends ReservationInput {
  id: string;
  uid: string;
  status: string;
  created_at: Timestamp | null;
}

export class ReservationError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ReservationError';
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validate(input: ReservationInput): void {
  const checkin = String(input.checkin ?? '');
  const checkout = String(input.checkout ?? '');
  const phone = String(input.user_phone ?? '').trim();

  if (!checkin || !checkout || !phone) {
    throw new ReservationError('Completa todos los campos de la solicitud.');
  }
  if (!DATE_RE.test(checkin) || !DATE_RE.test(checkout)) {
    throw new ReservationError('Usa fechas en formato YYYY-MM-DD.');
  }
  if (checkout <= checkin) {
    throw new ReservationError('La fecha de salida debe ser posterior a la de entrada.');
  }
  if (phone.replace(/\D/g, '').length < 7) {
    throw new ReservationError('Ingresa un teléfono de contacto válido.');
  }
}

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Crea la solicitud de reserva. Devuelve el id del documento. */
export async function createReservation(input: ReservationInput): Promise<string> {
  validate(input);

  const { auth, db } = await import('./firebase');
  const user = auth.currentUser;
  if (!user) throw new ReservationError('Debes iniciar sesión para reservar.', 401);

  const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');

  try {
    const reference = await addDoc(collection(db, 'reservations'), {
      uid: user.uid,
      checkin: input.checkin,
      checkout: input.checkout,
      user_phone: input.user_phone.trim(),
      status: 'pending',
      created_at: serverTimestamp(),
    });
    return reference.id;
  } catch (error) {
    console.warn('⚠️ createReservation falló:', reason(error));

    switch (errorCode(error)) {
      case 'permission-denied':
        throw new ReservationError(
          'No tienes permisos para enviar la solicitud. Inicia sesión nuevamente.',
          401,
        );
      case 'unavailable':
      case 'deadline-exceeded':
        throw new ReservationError('El servicio no responde. Intenta nuevamente en unos segundos.');
      default:
        throw new ReservationError('No fue posible enviar la solicitud de reserva.');
    }
  }
}

/** Reservas ordenadas por `created_at` desc — solo administradores. */
export async function getReservations(): Promise<ReservationRecord[]> {
  const { auth, db } = await import('./firebase');
  const user = auth.currentUser;

  if (!user) throw new ReservationError('Debes iniciar sesión como administrador.', 401);
  if (!(await isAdmin(user))) {
    throw new ReservationError('No tienes permisos de administrador.', 403);
  }

  const { collection, getDocs, orderBy, query } = await import('firebase/firestore');

  try {
    const snapshot = await getDocs(
      query(collection(db, 'reservations'), orderBy('created_at', 'desc')),
    );

    return snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        uid: String(data.uid ?? ''),
        checkin: String(data.checkin ?? ''),
        checkout: String(data.checkout ?? ''),
        user_phone: String(data.user_phone ?? ''),
        status: String(data.status ?? 'pending'),
        created_at: (data.created_at as Timestamp | undefined) ?? null,
      };
    });
  } catch (error) {
    console.warn('⚠️ getReservations falló:', reason(error));
    throw new ReservationError('No fue posible cargar las reservas.');
  }
}

export const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Actualiza el estado de una reserva (panel admin). Requiere sesión + rol admin.
 * Escribe `status` y `updated_at` con `serverTimestamp()`.
 */
export async function updateReservationStatus(id: string, status: ReservationStatus): Promise<void> {
  if (!id) throw new ReservationError('Reserva inválida.');
  if (!RESERVATION_STATUSES.includes(status)) throw new ReservationError('Estado no válido.');

  const { auth, db } = await import('./firebase');
  if (!auth.currentUser) throw new ReservationError('Tu sesión expiró. Inicia sesión nuevamente.', 401);
  if (!(await isAdmin(auth.currentUser))) {
    throw new ReservationError('No tienes permisos de administrador.', 403);
  }

  const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');

  try {
    await updateDoc(doc(db, 'reservations', id), { status, updated_at: serverTimestamp() });
  } catch (error) {
    console.warn('⚠️ updateReservationStatus falló:', reason(error));
    if (errorCode(error) === 'permission-denied') {
      throw new ReservationError('No tienes permisos para actualizar reservas.', 403);
    }
    throw new ReservationError('No fue posible actualizar la reserva.');
  }
}
