import { galleryService } from '../../lib/services';
import { useLiveList } from '../../lib/useLiveList';
import type { GalleryImage } from '../../lib/types';

/**
 * Miniaturas de galería en vivo (home y `/about-us`): se sincronizan con
 * Firestore mientras la isla esté montada (altas/ediciones en `/admin`).
 */
export default function GalleryHighlights({ images: initial }: { images: GalleryImage[] }) {
  const images = useLiveList(initial, galleryService.getImages, galleryService.subscribe);
  const highlights = images.slice(0, 4);

  if (highlights.length === 0) return null;

  return (
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {highlights.map((image) => (
        <a href="/gallery" class="photo-card group aspect-square" key={image.url}>
          <img
            src={image.url}
            alt={image.name || 'Entremonte Cabañas'}
            loading="lazy"
            decoding="async"
            width="320"
            height="320"
          />
        </a>
      ))}
    </div>
  );
}
