import { subscribeCollection } from '../live';
import { dataProvider } from '../providers';
import { toReview } from '../providers/FirebaseDataProvider';
import type { Review } from '../types';

/** Servicio unificado de reseñas. */
export const reviewService = {
  getAll: () => dataProvider.getReviews(),
  /** Suscripción en vivo (Firestore); no-op en otras fuentes de datos. */
  subscribe: (onChange: (rows: Review[]) => void) =>
    subscribeCollection('reviews', toReview, onChange),
};
