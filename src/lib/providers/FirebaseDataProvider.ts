import type { Firestore } from 'firebase/firestore';
import type { Cabin, GalleryImage, Review, SliderSlide } from '../types';
import type { DataProvider } from './DataProvider';
import { LocalDataProvider } from './LocalDataProvider';

/**
 * Provider de Firestore (SDK modular).
 *
 * - Implementa el mismo contrato `DataProvider` que api/local.
 * - Import perezoso de `firebase/*`: el SDK solo se carga cuando este provider
 *   se usa de verdad (así `PUBLIC_DATA_SOURCE=local|api` no paga su bundle y
 *   los builds sin `PUBLIC_FIREBASE_*` no revientan).
 * - Colección vacía → degrada a `LocalDataProvider` con `console.warn`.
 * - Errores de red/permisos → se propagan; el `withFallback` de la fábrica cae a local.
 *
 * El script `scripts/seed-firestore.mjs` escribe el campo `order` (posición en
 * el array original) para poder ordenar con `orderBy('order')`.
 */

type Raw = Record<string, unknown>;

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const strList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
/** Tarifa de Firestore; solo el campo dual, sin respaldos ni valores por defecto. */
const priceOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function toGallery(raw: Raw): GalleryImage {
  return { name: str(raw.name), url: str(raw.url) };
}

export function toSlider(raw: Raw): SliderSlide {
  return {
    title: str(raw.title),
    url: str(raw.url),
    message: str(raw.message) || undefined,
    link: str(raw.link) || undefined,
  };
}

export function toCabin(raw: Raw, id: string): Cabin {
  return {
    id: str(raw.id, id),
    name: str(raw.name, 'Cabaña'),
    capacity: num(raw.capacity),
    available: Boolean(raw.available),
    description: str(raw.description),
    images: strList(raw.images),
    services: strList(raw.services),
    priceWeekday: priceOf(raw.priceWeekday),
    priceWeekend: priceOf(raw.priceWeekend),
  };
}

export function toReview(raw: Raw): Review {
  const rawUser = raw.user;
  const user =
    rawUser !== null && typeof rawUser === 'object'
      ? {
          name: str((rawUser as Raw).name, 'Huésped'),
          avatar: str((rawUser as Raw).avatar) || null,
        }
      : { name: str(rawUser, 'Huésped'), avatar: null };

  return {
    user,
    creation_date: str(raw.creation_date) || undefined,
    rating: num(raw.rating),
    comment: str(raw.comment),
  };
}

export class FirebaseDataProvider implements DataProvider {
  readonly id = 'firebase' as const;
  private readonly local = new LocalDataProvider();

  /** Singleton del módulo `lib/firebase.ts`, cargado solo al primer uso. */
  private async firestore(): Promise<Firestore> {
    const { db } = await import('../firebase');
    return db;
  }

  private async readAll<T>(
    name: string,
    map: (raw: Raw, id: string) => T,
    fallback: () => Promise<T[]>,
  ): Promise<T[]> {
    const { collection, getDocs, orderBy, query } = await import('firebase/firestore');
    const db = await this.firestore();

    try {
      // Orden por la posición original; si ningún doc tiene `order` (colección
      // sin sembrar o altas manuales) reintentamos sin orden antes de degradar.
      const col = collection(db, name);
      const ordered = await getDocs(query(col, orderBy('order')));
      const snap = ordered.empty ? await getDocs(col) : ordered;

      if (snap.empty) {
        console.warn(`⚠️ [firebase] colección "${name}" vacía → usando provider [local].`);
        return fallback();
      }

      return snap.docs.map((document) => map(document.data() as Raw, document.id));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Firestore ${name}: ${reason}`);
    }
  }

  getGallery(): Promise<GalleryImage[]> {
    return this.readAll('gallery', toGallery, () => this.local.getGallery());
  }

  getSlider(): Promise<SliderSlide[]> {
    return this.readAll('slider', toSlider, () => this.local.getSlider());
  }

  getCabins(): Promise<Cabin[]> {
    return this.readAll('cabins', toCabin, () => this.local.getCabins());
  }

  async getCabinById(id: string): Promise<Cabin | null> {
    const { doc, getDoc } = await import('firebase/firestore');
    const db = await this.firestore();

    try {
      const snapshot = await getDoc(doc(db, 'cabins', id));
      if (snapshot.exists()) return toCabin(snapshot.data() as Raw, id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Firestore cabins/${id}: ${reason}`);
    }

    // Sin seed o id inexistente: el local devuelve `null` si tampoco lo conoce.
    console.warn(`⚠️ [firebase] cabina "${id}" no encontrada → usando provider [local].`);
    return this.local.getCabinById(id);
  }

  getReviews(): Promise<Review[]> {
    return this.readAll('reviews', toReview, () => this.local.getReviews());
  }
}
