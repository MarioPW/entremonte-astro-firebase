import { cabinService } from '../../lib/services';
import { useLiveList } from '../../lib/useLiveList';
import type { Cabin } from '../../lib/types';
import CabinCard from './CabinCard';

/**
 * Listado de cabañas en vivo (`/cabins`): pinta con los datos de build y
 * se sincroniza con Firestore mientras esté montado, de modo que los cambios
 * hechos en el panel admin (tarifas, descripción, servicios, imágenes…)
 * se reflejan sin volver a compilar.
 */
export default function CabinsGrid({ cabins: initial }: { cabins: Cabin[] }) {
  const cabins = useLiveList(initial, cabinService.getAll, cabinService.subscribe);

  return (
    <>
      <div class="section-head">
        <span class="eyebrow">Nuestras cabañas</span>
        <h2>Elige tu refugio en la naturaleza</h2>
        <p class="mx-auto mt-3 max-w-2xl text-ink-500">
          {cabins.length} {cabins.length === 1 ? ' opción disponible' : ' opciones disponibles'} ·
          todas con jacuzzi y desayuno incluido.
        </p>
      </div>

      {cabins.length === 0 ? (
        <p class="text-center text-ink-500">No hay cabañas disponibles en este momento.</p>
      ) : (
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cabins.map((cabin) => (
            <CabinCard key={cabin.id} cabin={cabin} />
          ))}
        </div>
      )}
    </>
  );
}
