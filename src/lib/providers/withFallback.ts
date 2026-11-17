import type { DataProvider } from './DataProvider';

/**
 * Decorator de resiliencia: intenta el provider principal y, ante cualquier
 * error (red, timeout, 5xx), cae suavemente al provider secundario.
 */
export function withFallback(primary: DataProvider, secondary: DataProvider): DataProvider {
  const degrade = (method: string, error: unknown): null => {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `⚠️ [${primary.id}] ${method} falló (${reason}) → usando provider [${secondary.id}].`,
    );
    return null;
  };

  const run = async <T>(method: string, call: () => Promise<T>, fallback: () => Promise<T>): Promise<T> => {
    try {
      return await call();
    } catch (error) {
      degrade(method, error);
      return fallback();
    }
  };

  return {
    id: primary.id,
    getGallery: () => run('getGallery', () => primary.getGallery(), () => secondary.getGallery()),
    getSlider: () => run('getSlider', () => primary.getSlider(), () => secondary.getSlider()),
    getCabins: () => run('getCabins', () => primary.getCabins(), () => secondary.getCabins()),
    getCabinById: (id) =>
      run(
        'getCabinById',
        async () => (await primary.getCabinById(id)) ?? secondary.getCabinById(id),
        () => secondary.getCabinById(id),
      ),
    getReviews: () => run('getReviews', () => primary.getReviews(), () => secondary.getReviews()),
  };
}
