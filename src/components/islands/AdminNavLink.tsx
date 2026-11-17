import { useEffect, useState } from 'preact/hooks';
import { isAdmin, onAuthChange } from '../../lib/auth';

/**
 * Enlace a `/admin` en la cabecera: solo se renderiza si la sesión activa está
 * verificada como administradora (`PUBLIC_ADMIN_EMAILS` o `admins/{uid}`).
 * Es puramente visual: el guard real vive en `/admin` (AdminApp) y en las
 * reglas de Firestore.
 */
export default function AdminNavLink({ current = false }: { current?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;

    onAuthChange(async (user) => {
      if (!active) return;
      if (!user) {
        setVisible(false);
        return;
      }
      try {
        const admin = await isAdmin(user);
        if (active) setVisible(admin);
      } catch {
        if (active) setVisible(false);
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

  if (!visible) return null;

  return (
    <a
      href="/admin"
      aria-current={current ? 'page' : undefined}
      class={`whitespace-nowrap text-sm font-semibold transition hover:text-brand-500 ${
        current ? 'text-brand-500' : 'text-ink-700'
      }`}
    >
      Administración
    </a>
  );
}
