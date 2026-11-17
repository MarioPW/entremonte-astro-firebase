import { useEffect, useRef, useState } from 'preact/hooks';
import {
  deleteGalleryItem,
  listGalleryItems,
  uploadGalleryImage,
  type GalleryDoc,
} from '../../../lib/admin/gallery';
import { adminMessage } from '../../../lib/admin/guards';
import { AdminButton, PanelMessage, card, field, label } from './ui';

/** Tab de galería: subir a Storage (+ doc en Firestore) y eliminar. */
export default function GalleryPanel() {
  const [items, setItems] = useState<GalleryDoc[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setMessage(null);
    setItems(null);
    try {
      setItems(await listGalleryItems());
    } catch (error) {
      setItems([]);
      setMessage(adminMessage(error, 'No fue posible cargar la galería.'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const upload = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    if (!file) {
      setMessage('Selecciona una imagen para subir.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const created = await uploadGalleryImage(file, name);
      setItems((previous) => [created, ...(previous ?? [])]);
      setFile(null);
      setName('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      setMessage(adminMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: GalleryDoc) => {
    if (!window.confirm(`¿Eliminar "${item.name}" de la galería?`)) return;
    setDeletingId(item.id);
    setMessage(null);
    try {
      await deleteGalleryItem(item);
      setItems((previous) => previous?.filter((image) => image.id !== item.id) ?? null);
    } catch (error) {
      setMessage(adminMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl">Galería</h2>
        <AdminButton onClick={() => void load()} variant="outline">
          Actualizar
        </AdminButton>
      </div>

      {message && <PanelMessage text={message} />}

      <form onSubmit={(event) => void upload(event)} class={`${card} mb-6`}>
        <div class="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label class={label} for="gallery-name">
              Nombre (opcional)
            </label>
            <input
              class={field}
              id="gallery-name"
              value={name}
              placeholder="Terraza al atardecer"
              onInput={(event) => setName(event.currentTarget.value)}
            />
          </div>
          <div>
            <label class={label} for="gallery-file">
              Imagen (máx. 5 MB)
            </label>
            <input
              ref={inputRef}
              class={`${field} sm:w-72`}
              id="gallery-file"
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div class="mt-4">
          <AdminButton type="submit" disabled={busy}>
            {busy ? 'Subiendo…' : 'Subir imagen'}
          </AdminButton>
        </div>
      </form>

      {items === null ? (
        <p class={`${card} text-sm text-ink-500`}>Cargando galería…</p>
      ) : items.length === 0 ? (
        <p class={`${card} text-sm text-ink-500`}>La galería está vacía.</p>
      ) : (
        <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} class="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
              {item.url ? (
                <img src={item.url} alt={item.name} loading="lazy" class="h-32 w-full object-cover" />
              ) : (
                <div class="flex h-32 w-full items-center justify-center bg-brand-50 text-xs text-ink-500">
                  sin imagen
                </div>
              )}
              <div class="p-3">
                <p class="truncate text-sm font-medium text-ink-900" title={item.name}>
                  {item.name || 'Sin nombre'}
                </p>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  disabled={deletingId === item.id}
                  class="mt-2 text-xs font-semibold text-red-700 underline hover:text-red-800 disabled:opacity-50"
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
