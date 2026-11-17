/**
 * Festivos de Colombia (aproximación para uso comercial: no incluye
 * festivos decretados por el gobierno de forma extraordinaria).
 *
 * Regla Ley Emiliani (Ley 51 de 1983): las fechas de la lista se observan
 * en su fecha; si caen en domingo se trasladan al lunes siguiente.
 */

/** Fijos: [mes 0-12, día] — en cualquier día de la semana. */
const FIXED: Array<[number, number]> = [
  [0, 1], // Año Nuevo
  [4, 1], // Día del Trabajo
  [6, 20], // Independencia
  [7, 7], // Batalla de Boyacá
  [7, 15], // Independencia de Cartagena
  [9, 12], // Día de la Raza
  [10, 1], // Todos los Santos
  [10, 11], // Independencia de Cartagena
  [11, 8], // Inmaculada Concepción
  [11, 25], // Navidad
];

/** Ley Emiliani: si caen en domingo, festivo el lunes siguiente. */
const EMILIANI: Array<[number, number]> = [
  [0, 6], // Reyes Magos
  [2, 19], // San José
  [4, 1], // Día del Trabajo
  [5, 29], // San Pedro y San Pablo
  [6, 20], // Independencia
  [7, 7], // Batalla de Boyacá
  [7, 15], // Independencia de Cartagena
  [9, 12], // Día de la Raza
  [10, 1], // Todos los Santos
  [10, 11], // Independencia de Cartagena
  [11, 8], // Inmaculada Concepción
];

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const key = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
};

const cache = new Map<number, Set<string>>();

/** Conjunto de fechas festivas (YYYY-MM-DD) de un año. */
export function colombianHolidays(year: number): Set<string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const dates = new Set<string>();
  const mark = (date: Date) => dates.add(key(date));

  // Fijos
  for (const [month, day] of FIXED) mark(new Date(year, month, day));

  // Semana Santa
  const easter = easterSunday(year);
  mark(addDays(easter, -3)); // Jueves Santo
  mark(addDays(easter, -2)); // Viernes Santo
  mark(addDays(easter, 39)); // Ascensión
  mark(addDays(easter, 60)); // Corpus Christi

  // Ley Emiliani: domingo → lunes siguiente
  for (const [month, day] of EMILIANI) {
    const date = new Date(year, month, day);
    if (date.getDay() === 0) mark(addDays(date, 1));
  }

  cache.set(year, dates);
  return dates;
}

/** true si la fecha es domingo, sábado o festivo colombiano. */
export function isWeekendOrHoliday(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return true;
  return colombianHolidays(date.getFullYear()).has(key(date));
}
