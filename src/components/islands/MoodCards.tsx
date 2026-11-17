import { galleryService } from '../../lib/services';
import { useLiveList } from '../../lib/useLiveList';
import type { GalleryImage } from '../../lib/types';

interface Props {
  /** Galería completa de build (solo se usa para pintar al montar). */
  images: GalleryImage[];
  /** Índices de la galería que alimentan cada tarjeta (p. ej. [3, 15, 12]). */
  indices: number[];
  /** Título de cada tarjeta (mismo orden que `indices`). */
  titles: string[];
}

/**
 * Tarjetas "atmósfera" de `/about-us`: toman fotos por posición dentro de la
 * galería y se actualizan solas cuando cambia la colección en `/admin`.
 */
export default function MoodCards({ images: initial, indices, titles }: Props) {
  const gallery = useLiveList(initial, galleryService.getImages, galleryService.subscribe);

  const cards = indices
    .map((index, position) => ({ title: titles[position], image: gallery[index] }))
    .filter((card): card is { title: string; image: GalleryImage } => Boolean(card.image));

  if (cards.length === 0) return null;

  return (
    <div class="grid gap-5 md:grid-cols-3">
      {cards.map((card) => (
        <a href="/gallery" class="photo-card group aspect-[4/3]" key={card.title}>
          <img
            src={card.image.url}
            alt={card.image.name}
            loading="lazy"
            decoding="async"
            width="400"
            height="300"
          />
          <div class="caption">
            <h3>{card.title}</h3>
          </div>
        </a>
      ))}
    </div>
  );
}
