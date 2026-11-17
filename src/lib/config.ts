/**
 * Configuración de la fuente de datos.
 *
 * PUBLIC_DATA_SOURCE:
 *   - "api"      → siempre el Django REST de Render
 *   - "local"    → siempre los JSON de src/data/
 *   - "firebase" → siempre Firestore (con caída a local si falla o está vacía)
 *   - "fallback" → API primero; si falla o expira, cae al JSON local (default)
 */

export type DataSourceMode = 'api' | 'local' | 'firebase' | 'fallback';

export const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL ??
  'https://entremonte-api-dashboard.onrender.com';

export const API_TIMEOUT_MS = Number(import.meta.env.PUBLIC_API_TIMEOUT_MS ?? 5000);

export function resolveDataSourceMode(): DataSourceMode {
  const raw = String(import.meta.env.PUBLIC_DATA_SOURCE ?? 'fallback').toLowerCase();
  if (raw === 'api' || raw === 'local' || raw === 'firebase') return raw;
  if (raw !== 'fallback') {
    console.warn(`⚠️ PUBLIC_DATA_SOURCE="${raw}" no reconocido; usando "fallback".`);
  }
  return 'fallback';
}
