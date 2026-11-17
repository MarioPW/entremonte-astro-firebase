import { subscribeCollection } from '../live';
import { dataProvider } from '../providers';
import { toSlider } from '../providers/FirebaseDataProvider';
import type { SliderSlide } from '../types';

/** Servicio unificado del slider hero. */
export const sliderService = {
  getSlides: () => dataProvider.getSlider(),
  /** Suscripción en vivo (Firestore); no-op en otras fuentes de datos. */
  subscribe: (onChange: (rows: SliderSlide[]) => void) =>
    subscribeCollection('slider', toSlider, onChange),
};
