import type { Cabin, GalleryImage, Review, ReviewUser, SliderSlide } from '../types';
import { API_BASE_URL, API_TIMEOUT_MS } from '../config';
import type { DataProvider } from './DataProvider';

/** El API no pagina, pero se tolera paginación DRF por si se activa. */
function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown }).results)) {
    return (payload as { results: T[] }).results;
  }
  throw new Error('Respuesta inesperada del API: se esperaba una lista');
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Normaliza el payload crudo de `/api/gallery/` (`{id, name, image}`) a `GalleryImage[]`. */
function toGallery(payload: unknown): GalleryImage[] {
  return asList<Record<string, unknown>>(payload)
    .map((raw) => ({ name: str(raw.name), url: str(raw.image) }))
    .filter((img) => img.url.startsWith('http'));
}

/** Normaliza el payload crudo de `/api/slider/` (`{title, url, message}`) a `SliderSlide[]`. */
function toSlider(payload: unknown): SliderSlide[] {
  return asList<Record<string, unknown>>(payload)
    .map((raw) => ({
      title: str(raw.title),
      url: str(raw.url),
      message: str(raw.message) || undefined,
      link: str(raw.link) || undefined,
    }))
    .filter((slide) => slide.url.startsWith('http'));
}

/** Tarifa del registro; solo el campo dual, sin respaldos ni valores por defecto. */
function priceOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Normaliza el payload crudo de `/api/cabins/` a `Cabin[]`. */
function toCabins(payload: unknown): Cabin[] {
  return asList<Record<string, unknown>>(payload).map((raw) => ({
    id: str(raw.id),
    name: str(raw.name, 'Cabaña'),
    capacity: num(raw.capacity),
    available: Boolean(raw.available),
    description: str(raw.description),
    images: Array.isArray(raw.images) ? raw.images.filter((i): i is string => typeof i === 'string') : [],
    services: Array.isArray(raw.services) ? raw.services.filter((s): s is string => typeof s === 'string') : [],
    priceWeekday: priceOf(raw.priceWeekday),
    priceWeekend: priceOf(raw.priceWeekend),
  }));
}

/**
 * Normaliza el payload crudo de `/api/review/` a `Review[]`.
 * Acepta `user` como objeto (`{name, avatar}`) o como string plano.
 */
function toReviews(payload: unknown): Review[] {
  return asList<Record<string, unknown>>(payload).map((raw) => {
    const rawUser = raw.user;
    const user: ReviewUser =
      rawUser !== null && typeof rawUser === 'object'
        ? {
            name: str((rawUser as Record<string, unknown>).name, 'Huésped'),
            avatar: str((rawUser as Record<string, unknown>).avatar) || null,
          }
        : { name: str(rawUser, 'Huésped'), avatar: null };

    return {
      user,
      creation_date: str(raw.creation_date) || undefined,
      rating: num(raw.rating),
      comment: str(raw.comment),
    };
  });
}

/**
 * Provider que consume el Django REST desplegado en Render.
 * Todas las peticiones llevan timeout para poder caer al provider local en build.
 */
export class ApiDataProvider implements DataProvider {
  readonly id = 'api' as const;

  constructor(
    private readonly baseUrl: string = API_BASE_URL,
    private readonly timeoutMs: number = API_TIMEOUT_MS,
  ) {}

  private async getJson<T>(path: string, parse: (payload: unknown) => T): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`API ${path} respondió ${response.status}`);
    }

    return parse(await response.json());
  }

  getGallery(): Promise<GalleryImage[]> {
    return this.getJson('/api/gallery/', toGallery);
  }

  getSlider(): Promise<SliderSlide[]> {
    return this.getJson('/api/slider/', toSlider);
  }

  getCabins(): Promise<Cabin[]> {
    return this.getJson('/api/cabins/', toCabins);
  }

  async getCabinById(id: string): Promise<Cabin | null> {
    try {
      const [cabin] = toCabins(await this.getJson<unknown>(`/api/cabins/${encodeURIComponent(id)}/`, (p) => p));
      return cabin ?? null;
    } catch (error) {
      if (error instanceof Error && /respondió 404/.test(error.message)) return null;
      throw error;
    }
  }

  getReviews(): Promise<Review[]> {
    return this.getJson('/api/review/', toReviews);
  }
}
