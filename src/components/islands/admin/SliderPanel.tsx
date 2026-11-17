import { useEffect, useState } from 'preact/hooks';
import { adminMessage } from '../../../lib/admin/guards';
import {
  addSlide,
  deleteSlide,
  listSlides,
  updateSlide,
  type SlideAdmin,
} from '../../../lib/admin/slider';
import { GalleryPickerModal } from './GalleryPicker';
import { AdminButton, PanelMessage, card, field, label } from './ui';

/** Estado de texto del formulario de diapositiva. */
interface SlideForm {
  title: string;
  message: string;
  url: string;
  link: string;
}

const fromSlide = (slide: SlideAdmin): SlideForm => ({
  title: slide.title,
  message: slide.message,
  url: slide.url,
  link: slide.link,
});

const emptyForm = (): SlideForm => ({ title: '', message: '', url: '', link: '' });

const sameForm = (a: SlideForm, b: SlideForm): boolean =>
  a.title === b.title && a.message === b.message && a.url === b.url && a.link === b.link;

/** Campos del slide: título, mensaje (subtítulo), enlace e imagen de galería. */
function SlideFields({
  form,
  onChange,
  idPrefix,
}: {
  form: SlideForm;
  onChange: (next: SlideForm) => void;
  idPrefix: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const patch = (partial: Partial<SlideForm>) => onChange({ ...form, ...partial });

  return (
    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <label class={label} for={`${idPrefix}-title`}>
          Título
        </label>
        <input
          class={field}
          id={`${idPrefix}-title`}
          value={form.title}
          placeholder="Un jardín fuera de Entremonte Cabañas"
          onInput={(event) => patch({ title: event.currentTarget.value })}
        />
      </div>

      <div>
        <label class={label} for={`${idPrefix}-message`}>
          Mensaje (subtítulo)
        </label>
        <input
          class={field}
          id={`${idPrefix}-message`}
          value={form.message}
          placeholder="Naturaleza en estado puro"
          onInput={(event) => patch({ message: event.currentTarget.value })}
        />
      </div>

      <div>
        <label class={label} for={`${idPrefix}-link`}>
          Enlace (opcional)
        </label>
        <input
          class={field}
          id={`${idPrefix}-link`}
          value={form.link}
          placeholder="/cabins o https://…"
          onInput={(event) => patch({ link: event.currentTarget.value })}
        />
      </div>

      <div class="sm:col-span-2">
        <p class={label}>Imagen</p>
        <div class="flex items-center gap-3">
          {form.url ? (
            <img
              src={form.url}
              alt=""
              class="h-16 w-28 shrink-0 rounded-lg border border-brand-100 object-cover"
            />
          ) : (
            <span class="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-brand-200 text-xs text-ink-500">
              sin imagen
            </span>
          )}
          <AdminButton variant="secondary" onClick={() => setPickerOpen(true)}>
            Seleccionar
          </AdminButton>
        </div>
      </div>

      {pickerOpen && (
        <GalleryPickerModal
          single
          assigned={[]}
          onClose={() => setPickerOpen(false)}
          onConfirm={(urls) => {
            if (urls[0]) patch({ url: urls[0] });
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

/** Tarjeta editable de una diapositiva. */
function SlideRow({ slide, onDeleted }: { slide: SlideAdmin; onDeleted: (id: string) => void }) {
  const [baseline, setBaseline] = useState(() => fromSlide(slide));
  const [form, setForm] = useState(() => fromSlide(slide));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const changed = !sameForm(form, baseline);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await updateSlide(slide.id, form);
      setBaseline(form);
    } catch (error) {
      setMessage(adminMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar la diapositiva "${slide.title}"?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteSlide(slide.id);
      onDeleted(slide.id);
    } catch (error) {
      setMessage(adminMessage(error));
      setBusy(false);
    }
  };

  return (
    <li class={card}>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="min-w-0 truncate text-lg">{slide.title || 'Sin título'}</h3>
        <div class="flex shrink-0 gap-2">
          <AdminButton variant="outline" onClick={() => void remove()} disabled={busy}>
            Eliminar
          </AdminButton>
          <AdminButton onClick={() => void save()} disabled={busy || !changed}>
            {busy ? 'Guardando…' : 'Guardar'}
          </AdminButton>
        </div>
      </div>

      {message && (
        <div class="mt-3">
          <PanelMessage text={message} />
        </div>
      )}

      <SlideFields form={form} onChange={setForm} idPrefix={`slide-${slide.id}`} />
    </li>
  );
}

/** Formulario de diapositiva nueva (siempre al final del orden). */
function NewSlideForm({ onCreated }: { onCreated: (slide: SlideAdmin) => void }) {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      onCreated(await addSlide(form));
      setForm(emptyForm());
    } catch (error) {
      setMessage(adminMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} class={`${card} mt-6`} noValidate>
      <h3 class="text-lg">Nueva diapositiva</h3>
      {message && (
        <div class="mt-3">
          <PanelMessage text={message} />
        </div>
      )}

      <SlideFields form={form} onChange={setForm} idPrefix="new-slide" />

      <div class="mt-4">
        <AdminButton type="submit" disabled={busy}>
          {busy ? 'Creando…' : 'Crear diapositiva'}
        </AdminButton>
      </div>
    </form>
  );
}

/** Tab del slider hero: listado editable + alta de diapositivas. */
export default function SliderPanel() {
  const [items, setItems] = useState<SlideAdmin[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setMessage(null);
    setItems(null);
    try {
      setItems(await listSlides());
    } catch (error) {
      setItems([]);
      setMessage(adminMessage(error, 'No fue posible cargar el slider.'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl">Slider principal</h2>
        <div class="flex gap-2">
          <AdminButton onClick={() => void load()} variant="outline">
            Actualizar
          </AdminButton>
          <AdminButton onClick={() => setShowNew((value) => !value)} variant="secondary">
            {showNew ? 'Ocultar formulario' : 'Nueva diapositiva'}
          </AdminButton>
        </div>
      </div>

      {message && <PanelMessage text={message} />}

      {items === null ? (
        <p class={`${card} text-sm text-ink-500`}>Cargando slider…</p>
      ) : items.length === 0 ? (
        <p class={`${card} text-sm text-ink-500`}>No hay diapositivas en Firestore todavía.</p>
      ) : (
        <ul class="space-y-4">
          {items.map((slide) => (
            <SlideRow
              key={slide.id}
              slide={slide}
              onDeleted={(id) => setItems((previous) => previous?.filter((item) => item.id !== id) ?? null)}
            />
          ))}
        </ul>
      )}

      {showNew && (
        <NewSlideForm
          onCreated={(slide) => {
            setItems((previous) => [...(previous ?? []), slide]);
            setShowNew(false);
          }}
        />
      )}
    </section>
  );
}
