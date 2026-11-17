import { useEffect, useState } from 'preact/hooks';
import {
  humanizeAuthError,
  loginWithEmail,
  loginWithGoogle,
  logout as signOutUser,
  onAuthChange,
  registerWithEmail,
} from '../../lib/auth';
import { createReservation, ReservationError } from '../../lib/reservations';

type Mode = 'login' | 'register';
type Feedback = { kind: 'success' | 'error'; text: string } | null;

const field =
  'w-full rounded-lg border border-brand-100 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-500/60 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500';

/**
 * Bloque de reserva: acceso con Firebase Auth (email + Google) y solicitud
 * de reserva escrita en Firestore. Consumo vía `@/lib/auth` y `@/lib/reservations`.
 */
export default function AuthBooking() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [today, setToday] = useState('');

  // La sesión solo se conoce en cliente: se resuelve tras la hidratación.
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    onAuthChange((user) => {
      if (active) setLoggedIn(Boolean(user));
    }).then((dispose) => {
      if (active) unsubscribe = dispose;
      else dispose();
    });

    setToday(new Date().toISOString().slice(0, 10));

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const submitAuth = async (event: Event) => {
    event.preventDefault();
    if (busy) return;

    const data = Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement).entries());
    const email = String(data.email ?? '').trim();
    const password = String(data.password ?? '');

    setFeedback(null);

    if (mode === 'login') {
      if (!email || !password) {
        setFeedback({ kind: 'error', text: 'Ingresa tu correo y tu contraseña.' });
        return;
      }

      setBusy(true);
      try {
        await loginWithEmail(email, password);
        setLoggedIn(true);
        setFeedback({ kind: 'success', text: 'Sesión iniciada. ¡Ya puedes enviar tu solicitud!' });
      } catch (error) {
        setFeedback({ kind: 'error', text: humanizeAuthError(error) });
      } finally {
        setBusy(false);
      }
      return;
    }

    const rePassword = String(data.re_password ?? '');
    if (!email || !password || !rePassword) {
      setFeedback({ kind: 'error', text: 'Completa todos los campos del registro.' });
      return;
    }
    if (password.length < 8) {
      setFeedback({ kind: 'error', text: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    if (password !== rePassword) {
      setFeedback({ kind: 'error', text: 'Las contraseñas deben coincidir.' });
      return;
    }

    setBusy(true);
    try {
      await registerWithEmail(email, password);
      setLoggedIn(true);
      setFeedback({ kind: 'success', text: '¡Cuenta creada! Ya puedes enviar tu solicitud.' });
    } catch (error) {
      setFeedback({ kind: 'error', text: humanizeAuthError(error) });
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    if (busy) return;
    setFeedback(null);
    setBusy(true);
    try {
      await loginWithGoogle();
      setLoggedIn(true);
      setFeedback({ kind: 'success', text: 'Sesión iniciada. ¡Ya puedes enviar tu solicitud!' });
    } catch (error) {
      setFeedback({ kind: 'error', text: humanizeAuthError(error) });
    } finally {
      setBusy(false);
    }
  };

  const submitReservation = async (event: Event) => {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries());

    const checkin = String(data.checkin ?? '');
    const checkout = String(data.checkout ?? '');
    const userPhone = String(data.user_phone ?? '').trim();

    setFeedback(null);

    if (!checkin || !checkout || !userPhone) {
      setFeedback({ kind: 'error', text: 'Completa todos los campos de la solicitud.' });
      return;
    }
    if (checkout <= checkin) {
      setFeedback({ kind: 'error', text: 'La fecha de salida debe ser posterior a la de entrada.' });
      return;
    }

    setBusy(true);
    try {
      await createReservation({
        checkin: new Date(`${checkin}T12:00:00`).toISOString().slice(0, 10),
        checkout: new Date(`${checkout}T12:00:00`).toISOString().slice(0, 10),
        user_phone: userPhone,
      });
      form.reset();
      setFeedback({
        kind: 'success',
        text: '¡Solicitud enviada! Te contactaremos para confirmar la disponibilidad.',
      });
    } catch (error) {
      const message = error instanceof ReservationError ? error.message : humanizeAuthError(error);
      // 401: permisos/sesión inválida → sincronizamos el estado con Firebase.
      if (error instanceof ReservationError && error.status === 401) void signOutUser();
      setFeedback({ kind: 'error', text: message });
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setFeedback(null);
  };

  const logout = () => {
    void signOutUser();
    setLoggedIn(false);
    setFeedback(null);
  };

  return (
    <div class="rounded-2xl border border-brand-100 bg-white p-6 shadow-xl shadow-brand-900/5 md:p-8">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-2xl">{loggedIn ? 'Reserva ahora' : 'Ingresa para reservar'}</h3>
        {loggedIn && (
          <button type="button" onClick={logout} class="text-xs font-medium text-ink-500 underline hover:text-brand-500">
            Cerrar sesión
          </button>
        )}
      </div>

      {/* Tabs login / registro */}
      {!loggedIn && (
        <div class="mt-5 flex rounded-full bg-brand-50 p-1 text-sm font-medium">
          {(['login', 'register'] as Mode[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchMode(tab)}
              aria-pressed={mode === tab}
              class={[
                'flex-1 rounded-full px-4 py-2 transition',
                mode === tab ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-500 hover:text-brand-500',
              ].join(' ')}
            >
              {tab === 'login' ? 'Ingresar' : 'Registrarme'}
            </button>
          ))}
        </div>
      )}

      {feedback && (
        <p
          role="status"
          class={[
            'mt-5 rounded-lg px-3.5 py-2.5 text-sm',
            feedback.kind === 'success'
              ? 'bg-brand-50 text-brand-600'
              : 'bg-red-50 text-red-700',
          ].join(' ')}
        >
          {feedback.text}
        </p>
      )}

      {!loggedIn ? (
        <form onSubmit={submitAuth} class="mt-5 space-y-4" noValidate>
          <div>
            <label class={label} for="auth-email">
              Correo
            </label>
            <input class={field} type="email" id="auth-email" name="email" autocomplete="email" required />
          </div>

          <div>
            <label class={label} for="auth-password">
              Contraseña
            </label>
            <input
              class={field}
              type="password"
              id="auth-password"
              name="password"
              autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
              minlength={mode === 'register' ? 8 : undefined}
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label class={label} for="auth-repassword">
                Repetir contraseña
              </label>
              <input
                class={field}
                type="password"
                id="auth-repassword"
                name="re_password"
                autocomplete="new-password"
                minlength={8}
                required
              />
            </div>
          )}

          <button type="submit" disabled={busy} class="btn btn-primary w-full disabled:opacity-60">
            {busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>

          <button
            type="button"
            onClick={submitGoogle}
            disabled={busy}
            class="btn btn-outline w-full disabled:opacity-60"
          >
            Continuar con Google
          </button>

          <p class="text-xs leading-relaxed text-ink-500">
            {mode === 'register'
              ? 'Tu cuenta se crea al instante y quedarás conectado para enviar tu solicitud.'
              : 'También puedes iniciar sesión con tu cuenta de Google.'}
          </p>
        </form>
      ) : (
        <form onSubmit={submitReservation} class="mt-5 space-y-4" noValidate>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class={label} for="checkin">
                Check-in
              </label>
              <input class={field} type="date" id="checkin" name="checkin" min={today} required />
            </div>
            <div>
              <label class={label} for="checkout">
                Check-out
              </label>
              <input class={field} type="date" id="checkout" name="checkout" min={today} required />
            </div>
          </div>

          <div>
            <label class={label} for="user_phone">
              Teléfono de contacto
            </label>
            <input
              class={field}
              type="tel"
              id="user_phone"
              name="user_phone"
              placeholder="Ej: 313 283 9584"
              autocomplete="tel"
              required
            />
          </div>

          <button type="submit" disabled={busy} class="btn btn-primary w-full disabled:opacity-60">
            {busy ? 'Enviando…' : 'Solicitar disponibilidad'}
          </button>

          <p class="text-xs leading-relaxed text-ink-500">
            Te confirmamos disponibilidad y tarifa por WhatsApp. ¿Prefieres agilizar?{' '}
            <a
              href="https://www.booking.com/hotel/co/entremonte-cabanas.es.html"
              target="_blank"
              rel="noopener"
              class="font-semibold text-brand-500 underline"
            >
              Reserva en Booking.com
            </a>
            .
          </p>
        </form>
      )}
    </div>
  );
}
