import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Practice } from './pages/Practice';
import { Chat } from './pages/Chat';
import { Mural } from './pages/Mural';
import { Regent } from './pages/Regent';
import { Profile } from './pages/Profile';
import { APP_NAME } from './lib/branding';
import { Music2 } from 'lucide-react';

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink-950 text-center">
      <div className="flex h-14 w-14 animate-pulseSoft items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-accent-500 text-ink-950">
        <Music2 className="h-7 w-7" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold tracking-[0.18em] text-white">{APP_NAME}</p>
        <p className="mt-1 text-xs text-slate-500">Preparando o treino…</p>
      </div>
    </div>
  );
}

function ReadyRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Practice />} />
        <Route path="mural" element={<Mural />} />
        <Route path="chat" element={<Chat />} />
        <Route path="regente" element={<Regent />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Gate() {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'signedOut') return <Login />;
  if (status === 'onboarding') return <Onboarding />;
  return <ReadyRoutes />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  );
}
