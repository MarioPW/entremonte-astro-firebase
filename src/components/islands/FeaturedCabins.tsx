import { cabinService } from '../../lib/services';
import { useLiveList } from '../../lib/useLiveList';
import type { Cabin } from '../../lib/types';
import CabinCard from './CabinCard';

/**
 * Cabañas destacadas del home: lista en vivo (máx. 4) centrada, con los
 * mismos anchos por hijo que la grilla anterior (gap 1.5rem).
 */
export default function FeaturedCabins({ cabins: initial }: { cabins: Cabin[] }) {
  const cabins = useLiveList(initial, cabinService.getAll, cabinService.subscribe);
  const featured = cabins.slice(0, 4);

  if (featured.length === 0) {
    return <p class="text-center text-ink-500">Pronto publicaremos nuestras cabañas.</p>;
  }

  return (
    <div class="flex flex-wrap justify-center gap-6 [&>*]:w-full sm:[&>*]:w-[calc(50%_-_0.75rem)] lg:[&>*]:w-[calc(25%_-_1.125rem)]">
      {featured.map((cabin) => (
        <CabinCard key={cabin.id} cabin={cabin} />
      ))}
    </div>
  );
}
