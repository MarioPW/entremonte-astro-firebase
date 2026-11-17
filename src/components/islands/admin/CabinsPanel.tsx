import { useEffect, useState } from 'preact/hooks';
import {
  addCabin,
  CABIN_SERVICES,
  listCabins,
  updateCabin,
  type CabinAdmin,
} from '../../../lib/admin/cabins';
import { adminMessage } from '../../../lib/admin/guards';
import { formatCOP } from '../../../lib/pricing';
import { GalleryPickerModal } from './GalleryPicker';
import { AdminButton, PanelMessage, card, field, label } from './ui';

/** Estado de texto del formulario de cabaña (strings para inputs controlados). */
interface FormState {
  name: string;
  capacity: string;
  priceWeekday: string;
  priceWeekend: string;
  description: string;
  available: boolean;
  images: string[];
  services: string[];
}

const priceText = (value: number | null): string => (value === null ? '' : String(value));
const parsePrice = (text: string): number | null => {
  const trimmed = text.trim();
  return trimmed === '' ? null : Number(trimmed);
};

function fromCabin(cabin: CabinAdmin): FormState {
  return {
    name: cabin.name,
    capacity: String(cabin.capacity),
    priceWeekday: priceText(cabin.priceWeekday),
    priceWeekend: priceText(cabin.priceWeekend),
    description: cabin.description,
    available: cabin.available,
    images: [...cabin.images],
    services: [...cabin.services],
  };
}

function emptyForm(): FormState {
  return {
    name: '',
    capacity: '2',
    priceWeekday: '',
    priceWeekend: '',
    description: '',
    available: true,
    images: [],
    services: [],
  };
}

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value) => b.includes(value));

const sameForm = (a: FormState, b: FormState): boolean =>
  a.name.trim() === b.name.trim() &&
  a.capacity === b.capacity &&
  a.priceWeekday.trim() === b.priceWeekday.trim() &&
  a.priceWeekend.trim() === b.priceWeekend.trim() &&
  a.description === b.description &&
  a.available === b.available &&
  a.images.length === b.images.length &&
  a.images.every((url, index) => url === b.images[index]) &&
  sameSet(a.services, b.services);

/** Resumen corto de tarifa: "430.000" o "Sin definir" (sin valores por defecto). */
const priceLabel = (text: string): string => {
  const value = Number(text.trim());
  return text.trim() !== '' && Number.isFinite(value) ? formatCOP(value) : 'Sin definir';
};

/** Checkboxes de servicios (catálogo `CABIN_SERVICES`). */
function ServicesSelector({
  selected,
  onChange,
  idPrefix,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}) {
  const toggle = (service: string, checked: boolean) =>
    onChange(checked ? [...selected, service] : selected.filter((value) => value !== service));

  return (
    <fieldset>
      <legend class={label}>Servicios</legend>
      <div class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {CABIN_SERVICES.map((service) => (
          <label
            key={service}
            class="flex cursor-pointer items-center gap-2 text-sm text-ink-700"
            for={`${idPrefix}-service-${service}`}
          >
            <input
              type="checkbox"
              id={`${idPrefix}-service-${service}`}
              checked={selected.includes(service)}
              onChange={(event) => toggle(service, event.currentTarget.checked)}
              class="size-4 accent-brand-600"
            />
            {service}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Miniaturas existentes + selector visual desde la galería (`GalleryPickerModal`). */
function ImagesEditor({ images, onChange }: { images: string[]; onChange: (next: string[]) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div>
      <p class={label}>Imágenes ({images.length})</p>

      {images.length > 0 && (
        <ul class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((image, index) => (
            <li key={image} class="group relative overflow-hidden rounded-lg border border-brand-100">
              <img src={image} alt={`Imagen ${index + 1}`} loading="lazy" class="h-20 w-full object-cover" />
              <button
                type="button"
                aria-label={`Quitar imagen ${index + 1}`}
                onClick={() => onChange(images.filter((value) => value !== image))}
                class="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink-900/70 text-xs font-bold text-white transition hover:bg-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div class="mt-3 flex flex-wrap gap-2">
        <AdminButton onClick={() => setPickerOpen(true)} variant="secondary">
          Seleccionar
        </AdminButton>
      </div>

      {pickerOpen && (
        <GalleryPickerModal
          assigned={images}
          onClose={() => setPickerOpen(false)}
          onConfirm={(urls) => {
            onChange([...images, ...urls.filter((value) => !images.includes(value))]);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Campos compartidos del formulario (alta y edición). Las tarifas son
 *  obligatorias: sin placeholders ni valores de respaldo. */
function CabinFields({
  state,
  onChange,
  idPrefix,
}: {
  state: FormState;
  onChange: (next: FormState) => void;
  idPrefix: string;
}) {
  const patch = (partial: Partial<FormState>) => onChange({ ...state, ...partial });

  return (
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <label class={label} for={`${idPrefix}-name`}>
          Nombre
        </label>
        <input
          class={field}
          id={`${idPrefix}-name`}
          value={state.name}
          placeholder="Cabaña 1"
          onInput={(event) => patch({ name: event.currentTarget.value })}
        />
      </div>

      <div>
        <label class={label} for={`${idPrefix}-capacity`}>
          Capacidad (personas)
        </label>
        <input
          class={field}
          id={`${idPrefix}-capacity`}
          type="number"
          min="1"
          value={state.capacity}
          onInput={(event) => patch({ capacity: event.currentTarget.value })}
        />
      </div>

      <div>
        <label class={label} for={`${idPrefix}-price-weekday`}>
          Tarifa entre semana (COP) *
        </label>
        <input
          class={field}
          id={`${idPrefix}-price-weekday`}
          type="number"
          min="0"
          step="1000"
          required
          value={state.priceWeekday}
          onInput={(event) => patch({ priceWeekday: event.currentTarget.value })}
        />
      </div>

      <div>
        <label class={label} for={`${idPrefix}-price-weekend`}>
          Tarifa fin de semana / festivos (COP) *
        </label>
        <input
          class={field}
          id={`${idPrefix}-price-weekend`}
          type="number"
          min="0"
          step="1000"
          required
          value={state.priceWeekend}
          onInput={(event) => patch({ priceWeekend: event.currentTarget.value })}
        />
      </div>

      <div class="flex items-end pb-2">
        <label
          class="flex cursor-pointer items-center gap-2 text-sm text-ink-700"
          for={`${idPrefix}-available`}
        >
          <input
            type="checkbox"
            id={`${idPrefix}-available`}
            checked={state.available}
            onChange={(event) => patch({ available: event.currentTarget.checked })}
            class="size-4 accent-brand-600"
          />
          Disponible para reservar
        </label>
      </div>

      <div class="sm:col-span-2">
        <label class={label} for={`${idPrefix}-description`}>
          Descripción
        </label>
        <textarea
          class={`${field} min-h-28 resize-y`}
          id={`${idPrefix}-description`}
          value={state.description}
          onInput={(event) => patch({ description: event.currentTarget.value })}
        />
      </div>

      <div class="sm:col-span-2">
        <ServicesSelector
          selected={state.services}
          onChange={(services) => patch({ services })}
          idPrefix={idPrefix}
        />
      </div>

      <div class="sm:col-span-2">
        <ImagesEditor images={state.images} onChange={(images) => patch({ images })} />
      </div>
    </div>
  );
}

/** Tarjeta editable de una cabaña (guarda con `updateDoc`). */
function CabinRow({ cabin }: { cabin: CabinAdmin }) {
  const [baseline, setBaseline] = useState(() => fromCabin(cabin));
  const [form, setForm] = useState(() => fromCabin(cabin));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const dirty = !sameForm(form, baseline);

  const save = async () => {
    // Tarifas obligatorias: sin valores por defecto, no se guarda vacío.
    if (form.priceWeekday.trim() === '' || form.priceWeekend.trim() === '') {
      setMessage('Las tarifas entre semana y de fin de semana / festivos son obligatorias.');
      return;
    }
    setBusy(true);
    setSaved(false);
    setMessage(null);
    try {
      // El nombre SIEMPRE viaja en el patch: nunca se vacía ni se ignora.
      await updateCabin(cabin.id, {
        name: form.name,
        capacity: Number(form.capacity),
        priceWeekday: parsePrice(form.priceWeekday),
        priceWeekend: parsePrice(form.priceWeekend),
        description: form.description,
        available: form.available,
        images: form.images,
        services: form.services,
      });
      setBaseline(form);
      setSaved(true);
    } catch (error) {
      setMessage(adminMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li class={card}>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          class="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden="true"
            class={`flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm text-brand-600 transition ${
              expanded ? 'rotate-90' : ''
            }`}
          >
            ›
          </span>
          <span class="min-w-0">
            <span class="block truncate font-semibold text-ink-900">
              {form.name.trim() || 'Sin nombre'}
            </span>
            <span class="block text-xs text-ink-500">
              {form.capacity} personas · Entre semana {priceLabel(form.priceWeekday)} ·
              Fin de semana {priceLabel(form.priceWeekend)}
              {dirty ? ' · Cambios sin guardar' : ''}
            </span>
          </span>
        </button>

        <div class="flex shrink-0 items-center gap-2">
          <span
            class={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              form.available
                ? 'bg-brand-50 text-brand-600 ring-brand-200'
                : 'bg-red-50 text-red-700 ring-red-200'
            }`}
          >
            {form.available ? 'Disponible' : 'No disponible'}
          </span>
          <AdminButton
            variant={expanded ? 'secondary' : 'primary'}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Cerrar' : 'Editar'}
          </AdminButton>
        </div>
      </div>

      {expanded && (
        <div>
          {message && <PanelMessage text={message} />}
          {saved && !message && <PanelMessage kind="success" text="Cambios guardados." />}

          <CabinFields state={form} onChange={setForm} idPrefix={`cabin-${cabin.id}`} />

          <div class="mt-4 flex flex-wrap items-center justify-end gap-3">
            <AdminButton onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </AdminButton>
          </div>
        </div>
      )}
    </li>
  );
}

/** Formulario de cabaña nueva (id automático en Firestore). */
function NewCabinForm({ onCreated }: { onCreated: (cabin: CabinAdmin) => void }) {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    if (form.priceWeekday.trim() === '' || form.priceWeekend.trim() === '') {
      setMessage('Las tarifas entre semana y de fin de semana / festivos son obligatorias.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const priceWeekday = parsePrice(form.priceWeekday);
      const priceWeekend = parsePrice(form.priceWeekend);
      const id = await addCabin({
        name: form.name,
        capacity: Number(form.capacity),
        description: form.description,
        available: form.available,
        priceWeekday,
        priceWeekend,
        images: form.images,
        services: form.services,
      });
      onCreated({
        id,
        name: form.name.trim(),
        capacity: Number(form.capacity),
        description: form.description.trim(),
        available: form.available,
        priceWeekday,
        priceWeekend,
        images: [...form.images],
        services: [...form.services],
      });
      setForm(emptyForm());
    } catch (error) {
      setMessage(adminMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} class={`${card} mt-6`} noValidate>
      <h3 class="text-lg">Nueva cabaña</h3>
      {message && (
        <div class="mt-3">
          <PanelMessage text={message} />
        </div>
      )}

      <CabinFields state={form} onChange={setForm} idPrefix="new-cabin" />

      <div class="mt-4">
        <AdminButton type="submit" disabled={busy}>
          {busy ? 'Creando…' : 'Crear cabaña'}
        </AdminButton>
      </div>
    </form>
  );
}

/** Tab de cabañas: lista editable + alta de cabañas. */
export default function CabinsPanel() {
  const [items, setItems] = useState<CabinAdmin[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setMessage(null);
    setItems(null);
    try {
      setItems(await listCabins());
    } catch (error) {
      setItems([]);
      setMessage(adminMessage(error, 'No fue posible cargar las cabañas.'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl">Cabañas</h2>
        <div class="flex gap-2">
          <AdminButton onClick={() => void load()} variant="outline">
            Actualizar
          </AdminButton>
          <AdminButton onClick={() => setShowNew((value) => !value)} variant="secondary">
            {showNew ? 'Ocultar formulario' : 'Nueva cabaña'}
          </AdminButton>
        </div>
      </div>

      {message && <PanelMessage text={message} />}

      {items === null ? (
        <p class={`${card} text-sm text-ink-500`}>Cargando cabañas…</p>
      ) : items.length === 0 ? (
        <p class={`${card} text-sm text-ink-500`}>No hay cabañas en Firestore todavía.</p>
      ) : (
        <ul class="space-y-4">
          {items.map((cabin) => (
            <CabinRow key={cabin.id} cabin={cabin} />
          ))}
        </ul>
      )}

      {showNew && (
        <NewCabinForm
          onCreated={(cabin) => {
            setItems((previous) => [cabin, ...(previous ?? [])]);
            setShowNew(false);
          }}
        />
      )}
    </section>
  );
}
