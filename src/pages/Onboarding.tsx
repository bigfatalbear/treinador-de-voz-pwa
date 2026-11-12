import { useState } from 'react';
import { LogOut, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { VOICE_PART_LABEL, VOICE_PARTS, type VoicePart } from '../types';
import { APP_NAME } from '../lib/branding';
import { Button, Card, Field, Input } from '../components/ui';
import { cn } from '../lib/utils';

export function Onboarding() {
  const { user, error, joinChoir, signOut } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [code, setCode] = useState('');
  const [voicePart, setVoicePart] = useState<VoicePart>('soprano');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const submit = async () => {
    setLocalError('');
    setSubmitting(true);
    try {
      await joinChoir(code, voicePart, name);
    } catch (joinError) {
      setLocalError((joinError as Error).message || 'Não foi possível entrar no coral.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-ink-950 px-4 py-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand-300">{APP_NAME}</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Entrar no coral</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" aria-hidden />
            Sair
          </Button>
        </div>

        <Card>
          <p className="text-sm leading-relaxed text-slate-300">
            Sua conta autenticou, mas ainda não há vínculo com o coral. Informe o código de convite
            fornecido pelo regente e escolha seu naipe.
          </p>

          <div className="mt-5 space-y-4">
            <Field label="Nome como aparece no coral">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                maxLength={80}
              />
            </Field>

            <Field
              label="Código de convite"
              hint="O código é validado no servidor. Sem ele, o acesso ao chat e às faixas é negado."
            >
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Código do coral"
                autoComplete="one-time-code"
                maxLength={80}
              />
            </Field>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-200">Seu naipe</p>
              <div className="grid grid-cols-2 gap-2">
                {VOICE_PARTS.map((part) => (
                  <button
                    key={part}
                    type="button"
                    onClick={() => setVoicePart(part)}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-sm font-medium transition',
                      voicePart === part
                        ? 'border-brand-400/60 bg-brand-500/15 text-brand-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                    )}
                    aria-pressed={voicePart === part}
                  >
                    {VOICE_PART_LABEL[part]}
                  </button>
                ))}
              </div>
            </div>

            {localError || error ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                {localError || error}
              </div>
            ) : null}

            <Button onClick={() => void submit()} loading={submitting} className="w-full" size="lg">
              <Users className="h-4 w-4" aria-hidden />
              Entrar no coral
            </Button>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden />
            <span>
              Seu papel e naipe ficam no registro de membro. O cliente não pode alterar o
              próprio papel; apenas o servidor concede o papel de regente.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
