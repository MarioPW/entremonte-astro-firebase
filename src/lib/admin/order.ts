/**
 * Posición de docs nuevos en colecciones con lectura `orderBy('order')`.
 *
 * Firestore **excluye** los docs que no tienen el campo `order`, así que
 * toda alta desde el panel admin debe escribirlo: `max(order) + 1`
 * (los docs sin el campo cuentan como 0).
 */
export async function nextOrder(name: string): Promise<number> {
  const { db } = await import('../firebase');
  const { collection, getDocs, orderBy, query } = await import('firebase/firestore');

  const ordered = await getDocs(query(collection(db, name), orderBy('order')));
  return (
    ordered.docs.reduce((max, document) => {
      const value = document.data().order;
      return Math.max(max, typeof value === 'number' ? value : 0);
    }, -1) + 1
  );
}
