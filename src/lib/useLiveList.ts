import { useEffect, useState } from 'preact/hooks';

/**
 * Lista en vivo para islas públicas: pinta al instante los datos de build
 * (props, SEO intacto) y los mantiene sincronizados con Firestore.
 *
 * - `load`: lectura puntual al montar y al volver a la pestaña.
 * - `subscribe`: suscripción en vivo opcional (no-op fuera de `firebase`).
 *
 * Nunca pinta una lista vacía: si la lectura falla o llega sin datos, se
 * conserva lo que ya hay (sin parpadeos ni saltos de layout).
 */
export function useLiveList<T>(
  initial: T[],
  load: () => Promise<T[]>,
  subscribe?: (onChange: (rows: T[]) => void) => Promise<() => void>,
): T[] {
  const [rows, setRows] = useState<T[]>(initial);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const apply = (next: T[]) => {
      if (active && next.length > 0) setRows(next);
    };

    load()
      .then(apply)
      .catch((error) => console.warn('⚠️ useLiveList (load):', error));

    if (subscribe) {
      subscribe(apply)
        .then((stop) => {
          if (active) unsubscribe = stop;
          else stop();
        })
        .catch((error) => console.warn('⚠️ useLiveList (subscribe):', error));
    }

    // Red de seguridad: refresco al volver a la pestaña (cubre cambios de /admin).
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        load().then(apply).catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onFocus);
      unsubscribe?.();
    };
    // `load`/`subscribe` provienen de servicios (objetos de módulo estables).
  }, []);

  return rows;
}
