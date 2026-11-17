import { resolveDataSourceMode } from '../config';
import type { DataProvider } from './DataProvider';
import { ApiDataProvider } from './ApiDataProvider';
import { FirebaseDataProvider } from './FirebaseDataProvider';
import { LocalDataProvider } from './LocalDataProvider';
import { withFallback } from './withFallback';

export type { DataProvider } from './DataProvider';
export { ApiDataProvider } from './ApiDataProvider';
export { FirebaseDataProvider } from './FirebaseDataProvider';
export { LocalDataProvider } from './LocalDataProvider';
export { withFallback } from './withFallback';

/**
 * Fábrica según `PUBLIC_DATA_SOURCE`:
 *   - "api"      → ApiDataProvider
 *   - "local"    → LocalDataProvider
 *   - "firebase" → FirebaseDataProvider (Firestore) con caída a local
 *   - "fallback" → ApiDataProvider con caída automática a LocalDataProvider
 */
export function createDataProvider(): DataProvider {
  const api = new ApiDataProvider();
  const local = new LocalDataProvider();

  switch (resolveDataSourceMode()) {
    case 'api':
      return api;
    case 'local':
      return local;
    case 'firebase':
      return withFallback(new FirebaseDataProvider(), local);
    default:
      return withFallback(api, local);
  }
}

/**
 * Única instancia consumida por servicios, páginas e islas.
 * Los consumidores no importan providers concretos: solo este módulo.
 */
export const dataProvider: DataProvider = createDataProvider();
