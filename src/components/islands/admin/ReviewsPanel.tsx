import { useEffect, useState } from 'preact/hooks';
import { addReview, deleteReview, listReviews, type ReviewDoc } from '../../../lib/admin/reviews';
import { adminMessage } from '../../../lib/admin/guards';
import { AdminButton, PanelMessage, Stars, card, field, label } from './ui';

/** Inicial del huésped para el avatar circular. */
function initial(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

/** Tab de reseñas: alta y borrado en la colección `reviews`. */
export default function ReviewsPanel() {
  const [items, setItems] = useState<ReviewDoc[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [guest, setGuest] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setMessage(null);
    setItems(null);
    try {
      setItems(await listReviews());
    } catch (error) {
      setItems([]);
      setMessage(adminMessage(error, 'No fue posible cargar las reseñas.'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const created = await addReview({ guest, rating: Number(rating), comment });
      setItems((previous) => [created, ...(previous ?? [])]);
      setGuest('');
      setComment('');
      setRating('5');
    } catch (error) {
      setMessage(adminMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: ReviewDoc) => {
    if (!window.confirm(`¿Eliminar la reseña de ${item.user.name}?`)) return;
    setDeletingId(item.id);
    setMessage(null);
    try {
      await deleteReview(item.id);
      setItems((previous) => previous?.filter((review) => review.id !== item.id) ?? null);
    } catch (error) {
      setMessage(adminMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl">Reseñas</h2>
        <AdminButton onClick={() => void load()} variant="outline">
          Actualizar
        </AdminButton>
      </div>

      {message && <PanelMessage text={message} />}

      <form onSubmit={(event) => void submit(event)} class={`${card} mb-6`}>
        <h3 class="text-lg">Añadir reseña</h3>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label class={label} for="review-guest">
              Huésped
            </label>
            <input
              class={field}
              id="review-guest"
              value={guest}
              placeholder="Nombre del huésped"
              onInput={(event) => setGuest(event.currentTarget.value)}
            />
          </div>
          <div>
            <label class={label} for="review-rating">
              Calificación
            </label>
            <select
              class={field}
              id="review-rating"
              value={rating}
              onChange={(event) => setRating(event.currentTarget.value)}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={String(value)}>
                  {value} de 5
                </option>
              ))}
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class={label} for="review-comment">
              Comentario
            </label>
            <textarea
              class={`${field} min-h-24 resize-y`}
              id="review-comment"
              value={comment}
              placeholder="Qué fue lo mejor de la estadía…"
              onInput={(event) => setComment(event.currentTarget.value)}
            />
          </div>
        </div>

        <div class="mt-4">
          <AdminButton type="submit" disabled={busy}>
            {busy ? 'Guardando…' : 'Publicar reseña'}
          </AdminButton>
        </div>
      </form>

      {items === null ? (
        <p class={`${card} text-sm text-ink-500`}>Cargando reseñas…</p>
      ) : items.length === 0 ? (
        <p class={`${card} text-sm text-ink-500`}>Aún no hay reseñas.</p>
      ) : (
        <ul class="space-y-4">
          {items.map((item) => (
            <li key={item.id} class={card}>
              <div class="flex items-start justify-between gap-4">
                <div class="flex min-w-0 items-center gap-3">
                  <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                    {initial(item.user.name)}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate font-semibold text-ink-900">{item.user.name}</p>
                    <p class="text-xs text-ink-500">{item.creation_date ?? 'Sin fecha'}</p>
                  </div>
                </div>
                <Stars rating={item.rating} />
              </div>

              <p class="mt-3 whitespace-pre-line text-sm text-ink-700">{item.comment}</p>

              <div class="mt-3">
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  disabled={deletingId === item.id}
                  class="text-xs font-semibold text-red-700 underline hover:text-red-800 disabled:opacity-50"
                >
                  {deletingId === item.id ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
