import type { ComponentChildren } from 'preact';

/** Estilos reutilizables del panel (mismos tokens que `global.css`). */
export const field =
  'w-full rounded-lg border border-brand-100 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500';

export const card = 'rounded-2xl border border-brand-100 bg-white p-5 shadow-sm md:p-6';

/** Botón compacto del panel. */
export function AdminButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  type = 'button',
}: {
  children: ComponentChildren;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'secondary';
  type?: 'button' | 'submit';
}) {
  const variants = {
    primary: 'btn-primary',
    outline: 'btn-outline',
    secondary: 'btn-secondary',
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      class={`btn px-5 py-2.5 text-xs ${variants[variant]} disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-accent-400/20 text-accent-600 ring-accent-400/50',
  confirmed: 'bg-brand-50 text-brand-600 ring-brand-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
};

/** Insignia de estado de reserva (pending / confirmed / cancelled). */
export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-ink-900/5 text-ink-700 ring-ink-900/10';
  const text = STATUS_LABELS[status] ?? status;

  return (
    <span class={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${style}`}>
      {text}
    </span>
  );
}

/** Aviso de error/éxito del panel. */
export function PanelMessage({ text, kind = 'error' }: { text: string; kind?: 'error' | 'success' }) {
  return (
    <p
      role="status"
      class={`mb-4 rounded-lg px-3.5 py-2.5 text-sm ${
        kind === 'success' ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-700'
      }`}
    >
      {text}
    </p>
  );
}

/** Calificación en estrellas (texto, sin dependencias). */
export function Stars({ rating }: { rating: number }) {
  const safe = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span class="text-accent-500" aria-label={`${safe} de 5`}>
      {'★'.repeat(safe)}
      {'☆'.repeat(5 - safe)}
    </span>
  );
}
