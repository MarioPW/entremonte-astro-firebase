import type { User } from 'firebase/auth';

/**
 * Autenticación con Firebase Auth (email/password + Google), en reemplazo de
 * los endpoints JWT del Django REST en Render (`/auth/jwt/create/`, etc.).
 *
 * Import perezoso de `./firebase` y `firebase/*`: nada de Firebase se ejecuta
 * en build/SSR — solo en el navegador cuando el usuario interactúa.
 *
 * Admin: `PUBLIC_ADMIN_EMAILS` (coma-separada, opcional). Si no está definida,
 * se consulta la colección `admins/{uid}` de Firestore.
 */

const ADMIN_EMAILS = String(import.meta.env.PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/** Mensajes en español por código de error de firebase/auth. */
const MESSAGES: Record<string, string> = {
  'auth/missing-email': 'El campo “Correo” es obligatorio.',
  'auth/invalid-email': 'Ingrese una dirección de correo electrónico válida.',
  'auth/missing-password': 'El campo “Contraseña” es obligatorio.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No se encontró una cuenta con el correo ingresado.',
  'auth/email-already-in-use': 'Este correo ya está registrado.',
  'auth/weak-password': 'La contraseña es demasiado corta. Debe contener al menos 8 caracteres.',
  'auth/popup-blocked':
    'El navegador bloqueó la ventana de Google. Permítela e inténtalo de nuevo.',
  'auth/popup-closed-by-user': 'La ventana de Google se cerró antes de completar el inicio de sesión.',
  'auth/cancelled-popup-request': 'La ventana de Google se cerró antes de completar el inicio de sesión.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos segundos e inténtalo de nuevo.',
  'auth/network-request-failed': 'El servicio no responde. Intenta nuevamente en unos segundos.',
  'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Auth.',
  'auth/operation-not-allowed': 'Este método de acceso no está habilitado en la consola de Firebase.',
  'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión para continuar.',
};

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';

/** Traduce cualquier error de Firebase (u otro) a un mensaje legible. */
export function humanizeAuthError(error: unknown): string {
  const mapped = MESSAGES[errorCode(error)];
  if (mapped) return mapped;

  if (error instanceof Error && /timeout|network/i.test(error.message)) {
    return 'El servicio no responde. Intenta nuevamente en unos segundos.';
  }
  if (error instanceof Error && error.message && !/^Firebase:/.test(error.message)) {
    return error.message;
  }
  return 'Ocurrió un error. Por favor, intenta nuevamente.';
}

/** `createUserWithEmailAndPassword` — Firebase inicia la sesión al crearla. */
export async function registerWithEmail(email: string, password: string): Promise<User> {
  const { auth } = await import('./firebase');
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

/** `signInWithEmailAndPassword`. */
export async function loginWithEmail(email: string, password: string): Promise<User> {
  const { auth } = await import('./firebase');
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

/** Ventana emergente de Google (`GoogleAuthProvider` + `signInWithPopup`). */
export async function loginWithGoogle(): Promise<User> {
  const { auth } = await import('./firebase');
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const credential = await signInWithPopup(auth, new GoogleAuthProvider());
  return credential.user;
}

/** Cierra la sesión (fire-and-forget en la UI). */
export async function logout(): Promise<void> {
  const { auth } = await import('./firebase');
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

/**
 * Suscribe un callback al cambio de sesión. Resuelve con la función de
 * cancelación (lista para `useEffect` de Preact).
 */
export async function onAuthChange(
  callback: (user: User | null) => void,
): Promise<() => void> {
  const { auth } = await import('./firebase');
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, callback);
}

/**
 * ¿Es administrador? Primero la lista `PUBLIC_ADMIN_EMAILS`; si está vacía,
 * busca el documento `admins/{uid}` en Firestore.
 */
export async function isAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;

  if (ADMIN_EMAILS.length > 0) {
    return ADMIN_EMAILS.includes((user.email ?? '').toLowerCase());
  }

  const { db } = await import('./firebase');
  const { doc, getDoc } = await import('firebase/firestore');
  const snapshot = await getDoc(doc(db, 'admins', user.uid));
  return snapshot.exists();
}
