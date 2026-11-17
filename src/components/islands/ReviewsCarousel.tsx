import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import emblaCarousel, { type EmblaCarouselType } from 'embla-carousel';
import { reviewService } from '../../lib/services';
import { useLiveList } from '../../lib/useLiveList';
import type { Review } from '../../lib/types';

interface Props {
  reviews: Review[];
}

const STAR =
  'M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z';

function Stars({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span class="inline-flex gap-0.5" role="img" aria-label={`${clamped} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          class={`h-4 w-4 ${i < clamped ? 'text-accent-500' : 'text-brand-100'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fill-rule="evenodd" clip-rule="evenodd" d={STAR} />
        </svg>
      ))}
    </span>
  );
}

/** Carrusel infinito de reseñas basado en embla-carousel (sin jQuery). */
export default function ReviewsCarousel({ reviews: initial }: Props) {
  const reviews = useLiveList(initial, reviewService.getAll, reviewService.subscribe);
  const viewportRef = useRef<HTMLDivElement>(null);
  const emblaRef = useRef<EmblaCarouselType | null>(null);
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState(0);

  const onSelect = useCallback(() => {
    const embla = emblaRef.current;
    if (embla) setSelected(embla.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!viewportRef.current) return;
    const embla = emblaCarousel(viewportRef.current, {
      loop: true,
      align: 'start',
      skipSnaps: false,
      duration: 30,
    });
    emblaRef.current = embla;
    setSnaps(embla.scrollSnapList().length);
    embla.on('select', onSelect).on('reInit', onSelect);
    onSelect();
    return () => embla.destroy();
  }, [onSelect, reviews.length]);

  const scrollPrev = () => emblaRef.current?.scrollPrev();
  const scrollNext = () => emblaRef.current?.scrollNext();
  const scrollTo = (index: number) => emblaRef.current?.scrollTo(index);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollNext();
    }
  };

  if (reviews.length === 0) return null;

  // z-50: por encima del header sticky (z-40) para que nunca trague los clics.
  const btn =
    'absolute top-1/2 z-50 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-brand-100 bg-white text-ink-700 shadow-md transition hover:bg-brand-50 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

  return (
    <div class="relative">
      {/* Viewport */}
      <div
        ref={viewportRef}
        class="overflow-hidden"
        role="region"
        aria-roledescription="carrusel"
        aria-label="Reseñas de huéspedes"
        tabindex={0}
        onKeyDown={onKeyDown}
      >
        <div class="flex touch-pan-y">
          {reviews.map((review, i) => (
            <div
              key={`${review.user.name}-${i}`}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${reviews.length}`}
              class="min-w-0 flex-[0_0_86%] px-3 first:pl-0 last:pr-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
            >
              <figure class="h-full rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
                <Stars rating={review.rating} />
                <blockquote class="mt-4 text-sm leading-relaxed text-ink-700">
                  “{review.comment}”
                </blockquote>
                <figcaption class="mt-4 flex items-center gap-3">
                  {review.user.avatar ? (
                    <img
                      src={review.user.avatar}
                      alt=""
                      width="40"
                      height="40"
                      loading="lazy"
                      decoding="async"
                      class="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold uppercase text-brand-600"
                    >
                      {review.user.name.charAt(0)}
                    </span>
                  )}
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold text-ink-900">{review.user.name}</span>
                    {review.creation_date && (
                      <span class="block text-xs text-ink-500">{review.creation_date}</span>
                    )}
                  </span>
                </figcaption>
              </figure>
            </div>
          ))}
        </div>
      </div>

      {/* Controles */}
      <button type="button" onClick={scrollPrev} aria-label="Reseña anterior" class={`${btn} -left-2 sm:-left-5`}>
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button type="button" onClick={scrollNext} aria-label="Reseña siguiente" class={`${btn} -right-2 sm:-right-5`}>
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Dots */}
      {snaps > 1 && (
        <div class="mt-6 flex justify-center gap-2" role="tablist" aria-label="Seleccionar reseña">
          {Array.from({ length: snaps }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === selected}
              aria-label={`Ir a la reseña ${i + 1}`}
              onClick={() => scrollTo(i)}
              class={`h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                i === selected ? 'w-6 bg-brand-600' : 'w-2.5 bg-brand-200 hover:bg-brand-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
