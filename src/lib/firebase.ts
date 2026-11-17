import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Inicialización única de Firebase (SDK modular v10+).
 *
 * Usa las variables `PUBLIC_FIREBASE_*` (visibles en el bundle del cliente;
 * la seguridad real vive en las reglas de Firestore/Storage y los dominios
 * autorizados en Firebase Auth).
 *
 * Singleton con `getApps()`: evita el error
 * "Firebase App named '[DEFAULT]' already exists" cuando Astro recarga
 * el módulo en dev (HMR) o cuando varias islas lo importan.
 */

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
  measurementId: import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app: FirebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

/**
 * Analytics (opcional): solo en navegador y con `PUBLIC_FIREBASE_MEASUREMENT_ID`.
 * Import perezoso de `firebase/analytics` para no cargarlo en build/SSR
 * (getAnalytics lanza fuera del navegador). Devuelve `null` si no aplica.
 */
export async function initAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined' || !firebaseConfig.measurementId) return null;

  try {
    const { getAnalytics } = await import('firebase/analytics');
    return getAnalytics(app);
  } catch (error) {
    console.warn('⚠️ Firebase Analytics no inicializado:', error instanceof Error ? error.message : error);
    return null;
  }
}

export default app;
