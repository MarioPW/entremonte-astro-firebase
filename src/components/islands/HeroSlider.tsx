import { useEffect, useRef, useState } from 'preact/hooks';
import { sliderService } from '../../lib/services';
import { useLiveList } from '../../lib/useLiveList';
import type { SliderSlide } from '../../lib/types';

interface Props {
  slides: SliderSlide[];
  heading: string;
  subheading?: string;
}

/** Variante de tamaño de la CDN de Booking (mismo hash `k`, distinta resolución). */
export function withImageSize(url: string, size: 'max300' | 'max500' | 'max1024x768'): string {
  return url.replace(/\/(max300|max500|max1024x768|max2048x2048)\//, `/${size}/`);
}

const INTERVAL = 6000;

/**
 * Hero con carrusel de fondo (fade + dots + autoplay + swipe).
 * Implementación propia: cero dependencias de carrusel.
 */
export default function HeroSlider({ slides: initialSlides, heading, subheading }: Props) {
  const slides = useLiveList(initialSlides, sliderService.getSlides, sliderService.subscribe);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  const hasSlides = slides.length > 0;

  // Si la lista encogió (borrados en /admin), el índice activo sigue válido.
  useEffect(() => {
    setIndex((current) => Math.min(current, slides.length - 1));
  }, [slides.length]);

  useEffect(() => {
    if (!hasSlides || slides.length < 2 || paused) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, INTERVAL);

    return () => window.clearInterval(timer);
  }, [hasSlides, slides.length, paused]);

  const goTo = (next: number) => setIndex(next);

  const onTouchStart = (event: TouchEvent) => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (touchStart.current === null || slides.length < 2) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
    touchStart.current = null;

    if (Math.abs(delta) < 50) return;
    setIndex((current) => (current + (delta < 0 ? 1 : -1) + slides.length) % slides.length);
  };

  return (
    <section
      class="relative isolate flex min-h-[560px] items-end overflow-hidden bg-brand-900 lg:min-h-[640px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carrusel"
      aria-label="Imágenes destacadas de Entremonte Cabañas"
    >
      {/* Slides */}
      <div class="absolute inset-0 -z-10">
        {hasSlides ? (
          slides.map((slide, i) => (
            <picture key={slide.url}>
              {/* Móvil: variante ligera (37–63 KB) para no penalizar el LCP */}
              <source media="(max-width: 768px)" srcSet={withImageSize(slide.url, 'max500')} />
              <img
                src={withImageSize(slide.url, 'max1024x768')}
                alt={slide.title}
                aria-hidden={i !== index}
                class="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
                style={{ opacity: i === index ? 1 : 0 }}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchpriority={i === 0 ? 'high' : 'auto'}
                decoding="async"
              />
            </picture>
          ))
        ) : (
          <div class="h-full w-full bg-gradient-to-br from-brand-700 to-brand-900" />
        )}
        <div class="absolute inset-0 bg-gradient-to-t from-brand-900/90 via-brand-900/45 to-brand-900/30" />
      </div>

      {/* Contenido */}
      <div class="shell w-full pb-16 pt-28 text-white">
        <p class="text-xs font-semibold uppercase tracking-[0.25em] text-accent-400">La Vega · Cundinamarca</p>
        <h1 class="mt-4 max-w-3xl text-4xl leading-tight text-white md:text-6xl">{heading}</h1>
        {subheading && <p class="mt-5 max-w-xl text-lg text-white/80">{subheading}</p>}

        {hasSlides && slides[index]?.message && (
          <p class="mt-3 text-sm italic text-white/70" aria-live="polite">
            {slides[index].link ? (
              <a
                href={slides[index].link}
                class="underline decoration-white/40 underline-offset-4 hover:text-accent-400"
              >
                {slides[index].message}
              </a>
            ) : (
              slides[index].message
            )}
          </p>
        )}

        <div class="mt-8 flex flex-wrap gap-3">
          <a href="/gallery" class="btn btn-accent">
            Ver imágenes
          </a>
          <a href="/cabins" class="btn btn-ghost">
            Conoce las cabañas
          </a>
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div class="mt-10 flex gap-2.5" role="tablist" aria-label="Seleccionar imagen">
            {slides.map((slide, i) => (
              <button
                key={slide.url}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Imagen ${i + 1}: ${slide.title}`}
                onClick={() => goTo(i)}
                class={[
                  'h-2 rounded-full transition-all duration-300',
                  i === index ? 'w-8 bg-accent-400' : 'w-2 bg-white/50 hover:bg-white/80',
                ].join(' ')}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
