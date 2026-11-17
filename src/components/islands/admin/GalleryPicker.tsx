import { useEffect, useState } from 'preact/hooks';
import { listGalleryItems, type GalleryDoc } from '../../../lib/admin/gallery';
import { adminMessage } from '../../../lib/admin/guards';
import { AdminButton } from './ui';

/**
 * Modal con la galería de Firestore (carga perezosa al abrir).
 * `single` = selección única (una sola imagen, p. ej. la del slider).
 */
export function GalleryPickerModal({
  assigned,
  onConfirm,
  onClose,
  single = false,
}: {
  assigned: string[];
  onConfirm: (urls: string[]) => void;
  onClose: () => void;
  single?: boolean;
}) {
  const [items, setItems] = useState<GalleryDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const assignedUrls = new Set(assigned);

  const load = async () => {
    setItems(null);
    setError(null);
    try {
      setItems((await listGalleryItems()).filter((item) => item.url !== ''));
    } catch (err) {
      setItems([]);
      setError(adminMessage(err, 'No fue posible cargar la galería.'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggle = (url: string, checked: boolean) =>
    setSelected((previous) =>
      single
        ? checked
          ? [url]
          : []
        : checked
          ? [...previous, url]
          : previous.filter((value) => value !== url),
    );

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Seleccionar imágenes de la galería"
        onClick={(event) => event.stopPropagation()}
      >
        <div class="flex items-start justify-between gap-3 border-b border-brand-100 px-5 py-4">
          <div>
            <h3 class="text-lg">Galería</h3>
            <p class="text-xs text-ink-500">
              {single
                ? 'Elige la imagen que quieres usar.'
                : 'Las ya asignadas se quitan con la × de la lista de imágenes.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            class="flex size-8 shrink-0 items-center justify-center rounded-full text-xl text-ink-500 hover:bg-brand-50 hover:text-ink-900"
          >
            ×
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          {error && <p class="mb-3 text-sm text-red-700">{error}</p>}
          {items === null ? (
            <p class="text-sm text-ink-500">Cargando galería…</p>
          ) : items.length === 0 ? (
            <p class="text-sm text-ink-500">No hay imágenes en la galería todavía.</p>
          ) : (
            <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => {
                const isAssigned = !single && assignedUrls.has(item.url);
                return (
                  <li key={item.id}>
                    <label
                      class={`relative block overflow-hidden rounded-lg border ${
                        isAssigned ? 'border-brand-500 ring-1 ring-brand-500/40' : 'border-brand-100'
                      } ${isAssigned ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        loading="lazy"
                        class="h-24 w-full object-cover"
                      />
                      <input
                        type="checkbox"
                        checked={isAssigned || selected.includes(item.url)}
                        disabled={isAssigned}
                        onChange={(event) => toggle(item.url, event.currentTarget.checked)}
                        class="absolute right-2 top-2 size-4 accent-brand-600"
                        aria-label={`Seleccionar ${item.name || 'imagen'}`}
                      />
                      {isAssigned && (
                        <span class="absolute left-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Asignada
                        </span>
                      )}
                      <span class="block truncate px-2 py-1 text-xs text-ink-700">
                        {item.name || 'Sin nombre'}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 px-5 py-4">
          <p class="text-xs text-ink-500">{selected.length} seleccionada(s)</p>
          <div class="flex gap-2">
            <AdminButton variant="outline" onClick={onClose}>
              Cancelar
            </AdminButton>
            <AdminButton onClick={() => onConfirm(selected)} disabled={selected.length === 0}>
              {single ? 'Asignar' : 'Asignar seleccionadas'}
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}
