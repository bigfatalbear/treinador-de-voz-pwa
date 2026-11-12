import { NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
  Home,
  MessageCircle,
  SlidersHorizontal,
  UserRound,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOnline } from '../lib/useOnline';
import { APP_LOGO_URL, APP_NAME, APP_UUID, APP_VERSION } from '../lib/branding';
import { cn, initials } from '../lib/utils';
import { PixButton } from './PixButton';

const navBase =
  'flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-medium transition';

export function Layout() {
  const { member } = useAuth();
  const online = useOnline();
  const isRegent = member?.role === 'regente';

  const navItems = [
    { to: '/', label: 'Treino', icon: Home, end: true },
    { to: '/mural', label: 'Mural', icon: BookOpen },
    { to: '/chat', label: 'Chat', icon: MessageCircle },
    ...(isRegent ? [{ to: '/regente', label: 'Regente', icon: SlidersHorizontal }] : []),
    { to: '/perfil', label: 'Perfil', icon: UserRound }
  ];

  return (
    <div className="min-h-dvh bg-ink-950">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img
            src={APP_LOGO_URL}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full bg-ink-900 object-contain ring-1 ring-white/10"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-wide text-white">{APP_NAME}</p>
            <p className="truncate text-[11px] text-slate-500">
              {member?.role === 'regente' ? 'Área do regente' : 'Treino vocal e coral'}
            </p>
          </div>
          <span
            className={cn(
              'hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium sm:inline-flex',
              online
                ? 'border-accent-400/30 bg-accent-500/10 text-accent-300'
                : 'border-amber-400/30 bg-amber-500/10 text-amber-200'
            )}
          >
            {online ? <Wifi className="h-3 w-3" aria-hidden /> : <WifiOff className="h-3 w-3" aria-hidden />}
            {online ? 'Online' : 'Offline'}
          </span>
          <NavLink
            to="/perfil"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-brand-200"
            aria-label="Abrir perfil"
          >
            {initials(member?.name || '?')}
          </NavLink>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 pb-44 pt-4 sm:px-4 md:pb-32">
        <Outlet />
      </main>

      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30">
        <PixButton />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    navBase,
                    isActive
                      ? 'bg-brand-500/15 text-brand-200'
                      : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <p className="sr-only">
        {APP_NAME}, versão {APP_VERSION}, identificador {APP_UUID}.
      </p>
    </div>
  );
}
