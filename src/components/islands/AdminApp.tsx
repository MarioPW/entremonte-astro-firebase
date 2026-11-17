import { useEffect, useState } from 'preact/hooks';
import type { User } from 'firebase/auth';
import {
  humanizeAuthError,
  isAdmin,
  loginWithEmail,
  loginWithGoogle,
  logout as signOutUser,
  onAuthChange,
} from '../../lib/auth';
import ReservationsPanel from './admin/ReservationsPanel';
import CabinsPanel from './admin/CabinsPanel';
import GalleryPanel from './admin/GalleryPanel';
import ReviewsPanel from './admin/ReviewsPanel';
import SliderPanel from './admin/SliderPanel';
import { AdminButton, card, field, label } from './admin/ui';

/**
 * Panel de administración (`/admin`).
 *
 * Página estática: TODO corre en cliente dentro de esta isla
 * (`client:only="preact"` en `admin.astro`). Estados:
 *   loading → login (email/Google) → denied (no admin) → ready (tabs CRUD).
 */

type View = 'loading' | 'login' | 'denied' | 'ready';
type Tab = 'reservations' | 'cabins' | 'gallery' | 'slider' | 'reviews';

const TABS: { id: Tab; text: string }[] = [
  { id: 'reservations', text: 'Reservas' },
  { id: 'cabins', text: 'Cabañas' },
  { id: 'gallery', text: 'Galería' },
  { id: 'slider', text: 'Slider' },
  { id: 'reviews', text: 'Reseñas' },
];

/** Pantalla de acceso: email/contraseña + Google. */
function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submitEmail = async (event: Event) => {
    event.preventDefault();
    if (busy) return;

    const data = Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement).entries());
    const email = String(data.email ?? '').trim();
    const password = String(data.password ?? '');

    if (!email || !password) {
      setMessage('Ingresa tu correo y tu contraseña.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await loginWithEmail(email, password);
      // onAuthChange en AdminApp cambia la vista si el usuario es admin.
    } catch (error) {
      setMessage(humanizeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await loginWithGoogle();
    } catch (error) {
      setMessage(humanizeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="mx-auto max-w-md">
      <div class={card}>
        <p class="eyebrow">Entremonte</p>
        <h1 class="mt-1 text-2xl">Panel de administración</h1>
        <p class="mt-2 text-sm text-ink-500">Inicia sesión con una cuenta administradora.</p>

        {message && <p class="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{message}</p>}

        <form onSubmit={(event) => void submitEmail(event)} class="mt-5 space-y-4" noValidate>
          <div>
            <label class={label} for="admin-email">
              Correo
            </label>
            <input class={field} type="email" id="admin-email" name="email" autocomplete="email" required />
          </div>

          <div>
            <label class={label} for="admin-password">
              Contraseña
            </label>
            <input
              class={field}
              type="password"
              id="admin-password"
              name="password"
              autocomplete="current-password"
              required
            />
          </div>

          <button type="submit" disabled={busy} class="btn btn-primary w-full disabled:opacity-60">
            {busy ? 'Un momento…' : 'Ingresar'}
          </button>

          <button
            type="button"
            onClick={() => void submitGoogle()}
            disabled={busy}
            class="btn btn-outline w-full disabled:opacity-60"
          >
            Continuar con Google
          </button>
        </form>
      </div>
    </div>
  );
}

/** Usuario autenticado sin rol admin. */
function DeniedScreen({ user, onSignOut, busy }: { user: User | null; onSignOut: () => void; busy: boolean }) {
  return (
    <div class="mx-auto max-w-md">
      <div class={`${card} text-center`}>
        <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-xl">🔒</div>
        <h1 class="mt-4 text-2xl">Acceso restringido</h1>
        <p class="mt-2 text-sm text-ink-500">
          {user?.email ? `La cuenta ${user.email} no tiene permisos de administrador.` : 'Esta cuenta no tiene permisos de administrador.'}
        </p>
        <div class="mt-5 flex justify-center">
          <AdminButton onClick={onSignOut} disabled={busy}>
            {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [view, setView] = useState<View>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('reservations');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;

    onAuthChange(async (changed) => {
      if (!active) return;

      if (!changed) {
        setUser(null);
        setView('login');
        return;
      }

      setUser(changed);
      setView('loading');
      try {
        const admin = await isAdmin(changed);
        if (active) setView(admin ? 'ready' : 'denied');
      } catch (error) {
        console.warn('⚠️ No se pudo verificar el rol admin:', error);
        if (active) setView('denied');
      }
    }).then((unsubscribe) => {
      if (active) dispose = unsubscribe;
      else unsubscribe();
    });

    return () => {
      active = false;
      dispose?.();
    };
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await signOutUser();
    } finally {
      setUser(null);
      setView('login');
      setSigningOut(false);
    }
  };

  if (view === 'loading') {
    return (
      <p class="py-16 text-center text-sm text-ink-500" role="status">
        Verificando acceso…
      </p>
    );
  }

  if (view === 'login') return <LoginScreen />;

  if (view === 'denied') {
    return <DeniedScreen user={user} onSignOut={() => void signOut()} busy={signingOut} />;
  }

  return (
    <div>
      <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="eyebrow">Entremonte</p>
          <h1 class="mt-1 text-2xl md:text-3xl">Panel de administración</h1>
          <p class="mt-1 text-sm text-ink-500">{user?.email ?? ''}</p>
        </div>
        <AdminButton variant="outline" onClick={() => void signOut()} disabled={signingOut}>
          {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
        </AdminButton>
      </header>

      <nav class="flex gap-1 overflow-x-auto border-b border-brand-100" aria-label="Secciones del panel">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
            class={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === item.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-ink-500 hover:text-brand-600'
            }`}
          >
            {item.text}
          </button>
        ))}
      </nav>

      <div class="mt-6">
        {tab === 'reservations' && <ReservationsPanel />}
        {tab === 'cabins' && <CabinsPanel />}
        {tab === 'gallery' && <GalleryPanel />}
        {tab === 'slider' && <SliderPanel />}
        {tab === 'reviews' && <ReviewsPanel />}
      </div>
    </div>
  );
}
