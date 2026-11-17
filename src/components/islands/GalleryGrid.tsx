import { useState } from 'preact/hooks';
import { galleryService } from '../../lib/services';
import { useLiveList } from '../../lib/useLiveList';
import type { GalleryImage } from '../../lib/types';

const INITIAL = 12;
const STEP = 12;

/**
 * Galería en vivo (`/gallery`): pinta las imágenes de build y se sincroniza
 * con Firestore mientras esté montada; el botón "Ver más" crece en cliente
 * (reemplaza al script de `gallery.astro`).
 */
export default function GalleryGrid({ images: initial }: { images: GalleryImage[] }) {
  const images = useLiveList(initial, galleryService.getImages, galleryService.subscribe);
  const [shown, setShown] = useState(INITIAL);

  const visible = images.slice(0, shown);
  const remaining = images.length - shown;

  return (
    <>
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((image, index) => (
          <figure
            class="photo-card group aspect-[4/3]"
            key={`${image.url}-${index}`}
            data-gallery-item
          >
            <img
              src={image.url}
              alt={image.name || 'Foto de Entremonte Cabañas'}
              loading={index < 6 ? 'eager' : 'lazy'}
              decoding="async"
              width="400"
              height="300"
            />
            <figcaption class="caption">
              <h3 class="text-base font-medium">{image.name}</h3>
            </figcaption>
          </figure>
        ))}
      </div>

      {remaining > 0 && (
        <div class="mt-10 text-center">
          <button type="button" class="btn btn-primary" onClick={() => setShown((value) => value + STEP)}>
            Ver más ({remaining} restantes)
          </button>
        </div>
      )}
    </>
  );
}
