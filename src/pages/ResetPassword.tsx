import { useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { APP_LOGO_URL, APP_NAME } from '../lib/branding';
import { Button, Card, Field, Input } from '../components/ui';

export function ResetPassword() {
  const { user, error, authenticating, updatePassword, signOut, clearError } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState('');

  const submit = async () => {
    setLocalError('');
    if (password.length < 6) {
      setLocalError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setLocalError('As senhas não coincidem.');
      return;
    }
    await updatePassword(password);
  };

  const backToLogin = () => {
    setLocalError('');
    clearError();
    void signOut();
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_40%)] bg-ink-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <img
            src={APP_LOGO_URL}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full bg-ink-900 object-contain ring-1 ring-white/10"
          />
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-white">{APP_NAME}</p>
            <p className="text-xs text-slate-500">Recuperação de acesso</p>
          </div>
        </header>

        <Card className="bg-ink-850/90">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
              <KeyRound className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-white">Crie uma nova senha</h1>
              <p className="text-xs text-slate-500">{user?.email || 'Sua conta no coral'}</p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Escolha uma senha com pelo menos 6 caracteres. Depois de salvar, você voltará para a tela
            de login.
          </p>

          {error || localError ? (
            <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              <p>{error || localError}</p>
              <button
                type="button"
                onClick={() => {
                  setLocalError('');
                  clearError();
                }}
                className="mt-2 underline"
              >
                Fechar
              </button>
            </div>
          ) : null}

          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Field label="Nova senha" hint="Mínimo de 6 caracteres.">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nova senha"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>
            <Field label="Confirmar nova senha">
              <Input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>
            <Button type="submit" loading={authenticating} className="w-full" size="lg">
              Salvar nova senha
            </Button>
            <button
              type="button"
              onClick={backToLogin}
              className="flex w-full items-center justify-center gap-1 text-center text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Voltar para o login
            </button>
          </form>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden />
            <span>
              O link de recuperação é temporário e só pode ser usado uma vez. Se ele expirar, solicite
              outro na tela de login.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
