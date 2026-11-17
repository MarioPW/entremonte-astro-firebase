import type { Cabin, GalleryImage, Review, SliderSlide } from '../types';
import type { DataProvider } from './DataProvider';

// Import estático: los JSON entran al bundle / al HTML en build, sin `fetch`.
import galleryData from '../../data/gallery.json';
import sliderData from '../../data/slider.json';
import cabinsData from '../../data/cabins.json';
import reviewsData from '../../data/reviews.json';

/**
 * Provider local: lee los JSON de `src/data/`.
 * Es el fallback cuando el API de Render falla o `PUBLIC_DATA_SOURCE=local`.
 */
export class LocalDataProvider implements DataProvider {
  readonly id = 'local' as const;

  async getGallery(): Promise<GalleryImage[]> {
    return galleryData;
  }

  async getSlider(): Promise<SliderSlide[]> {
    return sliderData;
  }

  async getCabins(): Promise<Cabin[]> {
    return cabinsData;
  }

  async getCabinById(id: string): Promise<Cabin | null> {
    const cabins = await this.getCabins();
    return cabins.find((cabin) => cabin.id === id) ?? null;
  }

  async getReviews(): Promise<Review[]> {
    return reviewsData;
  }
}
