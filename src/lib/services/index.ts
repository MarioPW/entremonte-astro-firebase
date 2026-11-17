/**
 * Punto único de consumo para páginas Astro e islas Preact (solo lecturas).
 * Importar solo desde aquí; no usar `fetch` ni providers directamente.
 *
 * Escrituras en cliente viven en `@/lib/auth` (Firebase Auth) y
 * `@/lib/reservations` (Firestore), en reemplazo de los endpoints JWT del
 * Django REST en Render.
 */

// Lectura (Repository Pattern)
export { galleryService } from './galleryService';
export { cabinService } from './cabinService';
export { sliderService } from './sliderService';
export { reviewService } from './reviewService';
