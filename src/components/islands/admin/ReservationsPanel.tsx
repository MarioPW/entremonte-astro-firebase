import { useEffect, useState } from 'preact/hooks';
import { adminMessage } from '../../../lib/admin/guards';
import {
  getReservations,
  updateReservationStatus,
  type ReservationRecord,
  type ReservationStatus,
} from '../../../lib/reservations';
import { AdminButton, PanelMessage, StatusBadge, card } from './ui';

const MS_PER_DAY = 86_400_000;

function nightsBetween(checkin: string, checkout: string): number {
  const start = new Date(`${checkin}T00:00:00`).getTime();
  const end = new Date(`${checkout}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / MS_PER_DAY);
}

const ACTIONS: { status: ReservationStatus; text: string; variant: 'primary' | 'outline' | 'secondary' }[] = [
  { status: 'confirmed', text: 'Confirmar', variant: 'primary' },
  { status: 'pending', text: 'Pendiente', variant: 'secondary' },
  { status: 'cancelled', text: 'Cancelar', variant: 'outline' },
];

/** Tabla/lista de solicitudes de reserva + cambio de estado. */
export default function ReservationsPanel() {
  const [items, setItems] = useState<ReservationRecord[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setMessage(null);
    setItems(null);
    try {
      setItems(await getReservations());
    } catch (error) {
      setItems([]);
      setMessage(adminMessage(error, 'No fue posible cargar las reservas.'));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const setStatus = async (id: string, status: ReservationStatus) => {
    setBusyId(id);
    setMessage(null);
    try {
      await updateReservationStatus(id, status);
      setItems((previous) => previous?.map((item) => (item.id === id ? { ...item, status } : item)) ?? null);
    } catch (error) {
      setMessage(adminMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl">Solicitudes de reserva</h2>
        <AdminButton onClick={() => void load()} variant="outline">
          Actualizar
        </AdminButton>
      </div>

      {message && <PanelMessage text={message} />}

      {items === null ? (
        <p class={`${card} text-sm text-ink-500`}>Cargando solicitudes…</p>
      ) : items.length === 0 ? (
        <p class={`${card} text-sm text-ink-500`}>
          Aún no hay solicitudes. Aparecerán aquí cuando un huésped reserve.
        </p>
      ) : (
        <ul class="space-y-4">
          {items.map((item) => {
            const nights = nightsBetween(item.checkin, item.checkout);
            return (
              <li key={item.id} class={card}>
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-semibold text-ink-900">📞 {item.user_phone || 'Sin teléfono'}</p>
                    <p class="mt-1 text-sm text-ink-500">
                      {item.checkin} → {item.checkout}
                      {nights > 0 ? ` · ${nights} ${nights === 1 ? 'noche' : 'noches'}` : ''}
                    </p>
                    <p class="mt-1 truncate text-xs text-ink-500/70">Huésped: {item.uid}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                  {ACTIONS.filter((action) => action.status !== item.status).map((action) => (
                    <AdminButton
                      key={action.status}
                      variant={action.variant}
                      disabled={busyId === item.id}
                      onClick={() => void setStatus(item.id, action.status)}
                    >
                      {busyId === item.id ? 'Guardando…' : action.text}
                    </AdminButton>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
