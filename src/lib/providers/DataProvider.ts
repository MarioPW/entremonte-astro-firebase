import type { Cabin, GalleryImage, Review, SliderSlide } from '../types';

/**
 * Interfaz única de datos: todo consumidor (páginas Astro, islas Preact)
 * habla solo con esta abstracción, nunca con `fetch` ni con un proveedor concreto.
 */
export interface DataProvider {
  /** Identificador del proveedor, útil para diagnóstico en build. */
  readonly id: 'api' | 'local' | 'firebase';

  getGallery(): Promise<GalleryImage[]>;
  getSlider(): Promise<SliderSlide[]>;
  getCabins(): Promise<Cabin[]>;
  /** Devuelve `null` si no existe (404) en vez de lanzar. */
  getCabinById(id: string): Promise<Cabin | null>;
  getReviews(): Promise<Review[]>;
}
