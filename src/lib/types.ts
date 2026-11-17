/**
 * Contrato canónico de datos del dominio Entremonte.
 *
 * Los providers (API / local) normalizan sus respuestas crutas a estos tipos.
 * Ninguna página o componente debe conocer la forma cruda del backend.
 */

/** Imagen de la galería. */
export interface GalleryImage {
  name: string;
  url: string;
}

/** Diapositiva del slider hero. */
export interface SliderSlide {
  title: string;
  url: string;
  message?: string;
  /** Enlace opcional al pulsar el mensaje (interno `/…` o http(s)://…). */
  link?: string;
}

/** Autor de una reseña. */
export interface ReviewUser {
  name: string;
  /** URL del avatar; `null` cuando el huésped no tiene foto. */
  avatar?: string | null;
}

/** Reseña de huésped (`GET/POST /api/review/`). */
export interface Review {
  user: ReviewUser;
  /** Fecha de publicación en texto, p. ej. "15 de febrero de 2026". */
  creation_date?: string;
  rating: number;
  comment: string;
}

/** Cabaña (`GET /api/cabins/`). Tarifas propias por cabaña (COP); si son
 *  `null`/ausentes se usan las globales de `lib/pricing.ts`.
 *  Las reseñas viven en su propia colección (`reviews`), nunca por cabaña. */
export interface Cabin {
  id: string;
  name: string;
  capacity: number;
  available: boolean;
  description: string;
  images: string[];
  services: string[];
  /** Tarifa entre semana (COP). Obligatoria; sin valores por defecto. */
  priceWeekday: number | null;
  /** Tarifa fin de semana / festivos (COP). Obligatoria; sin valores por defecto. */
  priceWeekend: number | null;
}
