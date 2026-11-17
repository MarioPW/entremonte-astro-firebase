import { subscribeCollection } from '../live';
import { dataProvider } from '../providers';
import { toGallery } from '../providers/FirebaseDataProvider';
import type { GalleryImage } from '../types';

/** Servicio unificado de galería. Consumido por páginas e islas (nunca `fetch`). */
export const galleryService = {
  getImages: () => dataProvider.getGallery(),
  /** Suscripción en vivo (Firestore); no-op en otras fuentes de datos. */
  subscribe: (onChange: (rows: GalleryImage[]) => void) =>
    subscribeCollection('gallery', toGallery, onChange),
};
