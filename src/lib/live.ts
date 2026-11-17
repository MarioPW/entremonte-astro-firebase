/**
 * Suscripción en vivo a colecciones de Firestore para las islas públicas.
 *
 * El sitio se despliega como HTML estático: sin esto, los cambios hechos en
 * `/admin` solo aparecerían tras volver a compilar. `onSnapshot` mantiene
 * cada lista sincronizada mientras la isla esté montada (sin recargar).
 */
import { resolveDataSourceMode } from './config';

/** Colecciones públicas con contenido administrable. */
export type LiveCollection = 'gallery' | 'slider' | 'cabins' | 'reviews';

type Row = Record<string, unknown>;

/**
 * Escucha `orderBy('order')` de `name` y entrega la lista mapeada en cada
 * cambio. Fuera de `firebase` (o ante errores) devuelve un no-op: el
 * consumidor conserva los datos que ya tenga (props de build).
 */
export async function subscribeCollection<T>(
  name: LiveCollection,
  map: (raw: Row, id: string) => T,
  onChange: (rows: T[]) => void,
): Promise<() => void> {
  if (resolveDataSourceMode() !== 'firebase') return () => {};

  try {
    const { db } = await import('./firebase');
    const { collection, onSnapshot, orderBy, query } = await import('firebase/firestore');
    const ordered = query(collection(db, name), orderBy('order'));

    return onSnapshot(ordered, {
      next: (snapshot) => {
        // Colección vacía → no se pinta nada (se conserva lo actual).
        if (snapshot.empty) return;
        onChange(snapshot.docs.map((document) => map(document.data() as Row, document.id)));
      },
      error: (error: { message?: string }) =>
        console.warn(`⚠️ [live] suscripción "${name}" falló:`, error?.message ?? error),
    });
  } catch (error) {
    console.warn(
      `⚠️ [live] "${name}" no disponible:`,
      error instanceof Error ? error.message : error,
    );
    return () => {};
  }
}
