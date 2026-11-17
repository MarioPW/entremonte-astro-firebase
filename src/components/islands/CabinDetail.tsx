import { formatCOP } from '../../lib/pricing';
import { cabinService } from '../../lib/services';
import { useLiveList } from '../../lib/useLiveList';
import type { Cabin } from '../../lib/types';

/**
 * Detalle de cabaña en vivo: pinta con los datos de build (SEO intacto) y
 * refresca desde Firestore al montar, reflejando al instante las ediciones
 * del panel admin (nombre, descripción, servicios, imágenes, tarifas…).
 */
export default function CabinDetail({ cabin: initial }: { cabin: Cabin }) {
  // Lista en vivo de cabañas: la isla se queda con la que coincide por id.
  const cabins = useLiveList([initial], cabinService.getAll, cabinService.subscribe);
  const cabin = cabins.find((item) => item.id === initial.id) ?? initial;

  const weekday = cabin.priceWeekday;
  const weekend = cabin.priceWeekend;

  return (
    <>
      <section class="page-head">
        <div class="shell">
          <nav class="crumbs" aria-label="Breadcrumb">
            <a href="/">Inicio</a>
            <span aria-hidden="true">/</span>
            <a href="/cabins">Cabañas</a>
            <span aria-hidden="true">/</span>
            <span class="text-white">{cabin.name}</span>
          </nav>
          <h1 class="mt-3">{cabin.name}</h1>
        </div>
      </section>

      {cabin.images.length > 0 && (
        <section class="shell -mt-8">
          <div class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:thin]">
            {cabin.images.map((image, index) => (
              <figure class="w-[85%] shrink-0 snap-start overflow-hidden rounded-2xl bg-brand-100 sm:w-[60%] lg:w-[48%]">
                <img
                  src={image}
                  alt={`${cabin.name} — foto ${index + 1}`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  width="640"
                  height="420"
                  class="aspect-[16/10] w-full object-cover"
                />
              </figure>
            ))}
          </div>
        </section>
      )}

      <section class="shell grid gap-10 py-12 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p class="text-sm uppercase tracking-wider text-ink-500">Tarifas</p>
            {weekday !== null && weekend !== null ? (
              <>
                <p class="text-3xl font-semibold text-brand-600">
                  {formatCOP(weekday)}
                  <span class="text-base font-normal text-ink-500"> COP / noche entre semana</span>
                </p>
                <p class="w-full text-sm text-ink-500 sm:w-auto">
                  {formatCOP(weekend)} COP los fines de semana y festivos
                </p>
              </>
            ) : (
              <p class="text-base text-ink-500">Tarifas a consultar</p>
            )}
            {!cabin.available && (
              <span class="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                No disponible actualmente
              </span>
            )}
          </div>

          <p class="mt-6 whitespace-pre-line leading-relaxed">{cabin.description}</p>

          <div class="mt-9">
            <h2 class="text-xl">Servicios incluidos</h2>
            <ul class="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {cabin.services.map((service) => (
                <li class="flex items-start gap-2.5 text-sm">
                  <svg
                    class="mt-0.5 h-4 w-4 shrink-0 text-brand-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2.2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span>{service}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside class="lg:sticky lg:top-28 lg:self-start">
          <div class="rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
            <h2 class="text-xl">Tu estadía</h2>

            <dl class="mt-4 space-y-3 text-sm">
              <div class="flex justify-between border-b border-brand-50 pb-3">
                <dt class="text-ink-500">Capacidad</dt>
                <dd class="font-semibold text-ink-900">
                  {cabin.capacity} {cabin.capacity === 1 ? 'persona' : 'personas'}
                </dd>
              </div>
              <div class="flex justify-between border-b border-brand-50 pb-3">
                <dt class="text-ink-500">Entre semana</dt>
                <dd class="font-semibold text-ink-900">
                  {weekday !== null ? `${formatCOP(weekday)} COP` : 'Consultar'}
                </dd>
              </div>
              <div class="flex justify-between border-b border-brand-50 pb-3">
                <dt class="text-ink-500">Fin de semana / festivo</dt>
                <dd class="font-semibold text-ink-900">
                  {weekend !== null ? `${formatCOP(weekend)} COP` : 'Consultar'}
                </dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-ink-500">Servicios</dt>
                <dd class="font-semibold text-ink-900">{cabin.services.length}</dd>
              </div>
            </dl>

            <div class="mt-6 space-y-3">
              <a href="/#reserva" class="btn btn-primary w-full">
                Solicitar reserva
              </a>
              <a
                href="https://www.booking.com/hotel/co/entremonte-cabanas.es.html"
                target="_blank"
                rel="noopener"
                class="btn btn-accent w-full"
              >
                Ver en Booking.com
              </a>
            </div>

            <p class="mt-5 text-xs leading-relaxed text-ink-500">
              Respuesta por WhatsApp en horario hábil. ¿Prefieres hablar ahora?
              <a
                href="https://wa.me/573132839584"
                target="_blank"
                rel="noopener"
                class="text-brand-500 underline"
              >
                +57 313 2839584
              </a>
            </p>
          </div>
        </aside>
      </section>
    </>
  );
}
