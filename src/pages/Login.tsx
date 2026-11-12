import { useState } from 'react';
import {
  BookOpen,
  CloudOff,
  Headphones,
  Mic2,
  Music2,
  ShieldCheck,
  SlidersHorizontal,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_DESCRIPTION, APP_NAME, APP_UUID } from '../lib/branding';
import { Badge, Button, Card } from '../components/ui';
import { PixButton } from '../components/PixButton';

const features = [
  { icon: SlidersHorizontal, title: 'Mixer por naipe', text: 'Volume independente e playback.' },
  { icon: Mic2, title: 'Afinador e overdub', text: 'Cante junto e corrija a afinação.' },
  { icon: Headphones, title: 'Loop A-B e BPM', text: 'Repita trechos sem mudar o tom.' },
  { icon: BookOpen, title: 'Letra e partitura', text: 'Acompanhe a letra sincronizada.' },
  { icon: Users, title: 'Chat por naipe', text: 'Geral, soprano, contralto, tenor e baixo.' },
  { icon: CloudOff, title: 'Offline', text: 'Baixe as faixas e ensaie sem internet.' }
];

export function Login() {
  const { mode, error, authenticating, signInGoogle, signInDemo, clearError } = useAuth();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_40%)] bg-ink-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-8">
        <header className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-ink-950 shadow-glow">
            <Music2 className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-white">{APP_NAME}</p>
            <p className="text-xs text-slate-500">Treino de coral offline</p>
          </div>
        </header>

        <main className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section>
            <Badge tone="brand">PWA · GitHub Pages · Firebase</Badge>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Ensaie com o coral,
              <span className="bg-gradient-to-r from-brand-300 to-accent-300 bg-clip-text text-transparent">
                {' '}
                mesmo sem internet.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
              {APP_DESCRIPTION}
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-300" aria-hidden />
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{feature.title}</p>
                      <p className="text-[11px] leading-snug text-slate-500">{feature.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <Card className="bg-ink-850/90">
            <h2 className="text-lg font-semibold text-white">Entrar</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {mode === 'firebase'
                ? 'Use sua conta Google autorizada pelo coral. O acesso é controlado por papéis no servidor.'
                : 'O Firebase ainda não está configurado. Use o modo demonstração para conhecer o app; os dados ficam apenas neste navegador.'}
            </p>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                <p>{error}</p>
                <button type="button" onClick={clearError} className="mt-2 underline">
                  Fechar
                </button>
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {mode === 'firebase' ? (
                <Button onClick={() => void signInGoogle()} loading={authenticating} className="w-full" size="lg">
                  <GoogleMark />
                  Entrar com Google
                </Button>
              ) : (
                <>
                  <Button onClick={() => signInDemo('regente')} className="w-full" size="lg">
                    Entrar como regente (demo)
                  </Button>
                  <Button onClick={() => signInDemo('coralista')} variant="secondary" className="w-full" size="lg">
                    Entrar como coralista (demo)
                  </Button>
                </>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden />
              <span>
                Não coletamos analytics de comportamento. O microfone do afinador é processado no
                dispositivo. Áudios de chat ficam restritos ao coral e expiram em 90 dias.
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              className="mt-4 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              {showDetails ? 'Ocultar detalhes técnicos' : 'Detalhes técnicos'}
            </button>
            {showDetails ? (
              <div className="mt-2 space-y-1 rounded-2xl border border-white/5 bg-ink-900 p-3 text-[10px] leading-relaxed text-slate-500">
                <p>Identificador de marca: {APP_UUID}</p>
                <p>
                  O GitHub Pages entrega apenas arquivos estáticos. Login, banco, arquivos e APIs
                  confiáveis rodam no Firebase/Google Cloud, nunca no navegador.
                </p>
                <p>
                  Sem configuração do Firebase, nenhum dado sai deste dispositivo. Nenhum segredo é
                  embutido no JavaScript.
                </p>
              </div>
            ) : null}
          </Card>
        </main>

        <footer className="mt-4 flex flex-col items-center gap-2 text-center">
          <PixButton compact />
          <p className="text-[10px] text-slate-600">
            {APP_NAME} · v1.0.0 · UUID {APP_UUID}
          </p>
        </footer>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.7-.06-1.37-.18-2.02H12v3.82h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.33Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.44l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.88a6 6 0 0 1 0-3.76V7.53H3.06a10 10 0 0 0 0 8.94l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.99c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.53l3.34 2.59C7.19 7.75 9.4 5.99 12 5.99Z"
      />
    </svg>
  );
}
