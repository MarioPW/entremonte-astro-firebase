/**
 * Formato de tarifas (COP por noche).
 *
 * Los valores de las tarifas viven exclusivamente en Firestore, en cada
 * cabaña (`priceWeekday` / `priceWeekend`); aquí solo queda el formateo
 * de pesos colombianos.
 */

/** Formatea pesos colombianos: 430000 → "430.000". */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount);
}
