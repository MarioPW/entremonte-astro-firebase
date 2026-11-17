import type { User } from 'firebase/auth';
import { isAdmin } from '../auth';

/**
 * Guardas y utilidades del panel de administración.
 * Todas las operaciones admin se validan aquí ANTES de tocar Firestore
 * (además de las reglas del lado del servidor).
 */

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AdminError';
  }
}

export const errorCodeOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

export const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Usuario autenticado (ya resuelto por `onAuthChange`) o 401. */
export async function requireUser(): Promise<User> {
  const { auth } = await import('../firebase');
  if (!auth.currentUser) {
    throw new AdminError('Tu sesión expiró. Inicia sesión nuevamente.', 401);
  }
  return auth.currentUser;
}

/** Usuario administrador o error (401 sin sesión / 403 sin rol). */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!(await isAdmin(user))) {
    throw new AdminError('No tienes permisos de administrador.', 403);
  }
  return user;
}

/** Mensaje legible para la UI admin (nunca expone detalles internos). */
export function adminMessage(
  error: unknown,
  fallback = 'La operación falló. Intenta de nuevo.',
): string {
  if (error instanceof AdminError) return error.message;

  switch (errorCodeOf(error)) {
    case 'permission-denied':
      return 'No tienes permisos para esta operación.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'El servicio no responde. Intenta de nuevo.';
    case 'resource-exhausted':
      return 'Cuota de Firebase agotada por ahora. Intenta más tarde.';
  }

  const message = error instanceof Error ? error.message : '';
  return message && !/^Firebase:/.test(message) ? message : fallback;
}
