import type { Review } from '../types';
import { AdminError, adminMessage, reasonOf, requireAdmin } from './guards';
import { nextOrder } from './order';

/**
 * CRUD de reseñas (colección `reviews`).
 * La forma guardada es la misma que consume el sitio público:
 * `{user: {name, avatar}, rating, comment, creation_date}`.
 */

export interface ReviewDoc extends Review {
  id: string;
}

export interface ReviewDraft {
  guest: string;
  rating: number;
  comment: string;
}

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

function toReviewDoc(id: string, data: Record<string, unknown>): ReviewDoc {
  const rawUser = data.user;
  const user =
    rawUser !== null && typeof rawUser === 'object'
      ? {
          name: str((rawUser as Record<string, unknown>).name, 'Huésped'),
          avatar: str((rawUser as Record<string, unknown>).avatar) || null,
        }
      : { name: str(rawUser, 'Huésped'), avatar: null };

  return {
    id,
    user,
    creation_date: str(data.creation_date) || undefined,
    rating: typeof data.rating === 'number' ? data.rating : 0,
    comment: str(data.comment),
  };
}

/** "13 de noviembre de 2026" — mismo formato que las reseñas existentes. */
function todayInSpanish(): string {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(),
  );
}

function validate(draft: ReviewDraft): void {
  if (!draft.guest.trim()) throw new AdminError('Indica el nombre del huésped.');
  if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5) {
    throw new AdminError('La calificación debe estar entre 1 y 5.');
  }
  if (!draft.comment.trim()) throw new AdminError('La reseña no puede quedar vacía.');
  if (draft.comment.length > 2000) throw new AdminError('La reseña supera los 2000 caracteres.');
}

/** Reseñas con id de documento. Requiere admin. */
export async function listReviews(): Promise<ReviewDoc[]> {
  await requireAdmin();

  const { db } = await import('../firebase');
  const { collection, getDocs, orderBy, query } = await import('firebase/firestore');

  try {
    // `order` lo escribe el seed; si no existe, Firestore excluye docs → sin orden.
    const target = collection(db, 'reviews');
    const ordered = await getDocs(query(target, orderBy('order')));
    const snapshot = ordered.empty ? await getDocs(target) : ordered;
    return snapshot.docs.map((document) => toReviewDoc(document.id, document.data()));
  } catch (error) {
    console.warn('⚠️ listReviews falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible cargar las reseñas.'));
  }
}

/** Añade una reseña (`addDoc`). Requiere admin. */
export async function addReview(draft: ReviewDraft): Promise<ReviewDoc> {
  await requireAdmin();
  validate(draft);

  const { db } = await import('../firebase');
  const { addDoc, collection } = await import('firebase/firestore');

  const payload = {
    user: { name: draft.guest.trim(), avatar: null },
    rating: draft.rating,
    comment: draft.comment.trim(),
    creation_date: todayInSpanish(),
    // Requerido por la lectura pública `orderBy('order')` (ver `order.ts`).
    order: await nextOrder('reviews'),
  };

  try {
    const document = await addDoc(collection(db, 'reviews'), payload);
    return { id: document.id, ...payload };
  } catch (error) {
    console.warn('⚠️ addReview falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible guardar la reseña.'));
  }
}

/** Elimina una reseña (`deleteDoc`). Requiere admin. */
export async function deleteReview(id: string): Promise<void> {
  await requireAdmin();
  if (!id) throw new AdminError('Reseña inválida.');

  const { db } = await import('../firebase');
  const { deleteDoc, doc } = await import('firebase/firestore');

  try {
    await deleteDoc(doc(db, 'reviews', id));
  } catch (error) {
    console.warn('⚠️ deleteReview falló:', reasonOf(error));
    throw new AdminError(adminMessage(error, 'No fue posible eliminar la reseña.'));
  }
}
