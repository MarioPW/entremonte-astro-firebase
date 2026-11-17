import { subscribeCollection } from '../live';
import { dataProvider } from '../providers';
import { toCabin } from '../providers/FirebaseDataProvider';
import type { Cabin } from '../types';

/** Servicio unificado de cabañas. */
export const cabinService = {
  getAll: () => dataProvider.getCabins(),
  getById: (id: string) => dataProvider.getCabinById(id),
  /** Suscripción en vivo (Firestore); no-op en otras fuentes de datos. */
  subscribe: (onChange: (rows: Cabin[]) => void) =>
    subscribeCollection('cabins', toCabin, onChange),
};
