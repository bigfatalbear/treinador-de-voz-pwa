import { useEffect, useState } from 'react';
import {
  CloudOff,
  Database,
  ExternalLink,
  LogOut,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { callFunction, firebaseErrorMessage } from '../lib/firebase';
import { APP_NAME, APP_UUID, APP_VERSION, GITHUB_REPO, RETENTION_DAYS } from '../lib/branding';
import { clearOfflineCache, offlineCacheSize } from '../lib/cache';
import { VOICE_PART_LABEL, VOICE_PARTS, type VoicePart } from '../types';
import { bytesToSize, cn } from '../lib/utils';
import { Badge, Button, Card, Field, Input, SectionTitle, Select } from '../components/ui';
import { PixButton } from '../components/PixButton';

export function Profile() {
  const { member, user, mode, updateMember, signOut, signInDemo } = useAuth();
  const { notify } = useToast();
  const [name, setName] = useState(member?.name || '');
  const [voicePart, setVoicePart] = useState<VoicePart>(member?.voicePart || 'soprano');
  const [saving, setSaving] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(member?.name || '');
    setVoicePart(member?.voicePart || 'soprano');
  }, [member?.name, member?.voicePart]);

  useEffect(() => {
    void offlineCacheSize().then(setCacheSize).catch(() => setCacheSize(0));
  }, []);

  if (!member) return null;

  const save = async () => {
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      notify('Informe seu nome com pelo menos 2 caracteres.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateMember({ name: cleanName, voicePart });
      notify('Perfil atualizado.', 'success');
    } catch (error) {
      notify(firebaseErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const clearCache = async () => {
    if (!window.confirm('Apagar todas as faixas baixadas para uso offline neste dispositivo?')) return;
    await clearOfflineCache();
    setCacheSize(0);
    notify('Cache offline apagado.', 'success');
  };

  const deleteAccount = async () => {
    if (
      !window.confirm(
        'Apagar sua conta e seus dados do coral? Esta ação remove seu vínculo, seus votos e suas mensagens. Não pode ser desfeita.'
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await callFunction('deleteMyData', {});
      notify('Conta e dados apagados.', 'success');
      await signOut();
    } catch (error) {
      notify(firebaseErrorMessage(error), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-brand-300">Perfil</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Sua conta</h1>
        <p className="mt-1 text-xs text-slate-500">
          {mode === 'demo'
            ? 'Modo demonstração: os dados ficam apenas neste navegador.'
            : 'Conta Google vinculada ao coral.'}
        </p>
      </div>

      <Card>
        <SectionTitle
          title="Dados do coral"
          subtitle="Nome e naipe podem ser alterados por você; o papel não"
          action={<Badge tone={member.role === 'regente' ? 'accent' : 'neutral'}>{member.role}</Badge>}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          </Field>
          <Field label="Naipe">
            <Select
              value={voicePart}
              onChange={(event) => setVoicePart(event.target.value as VoicePart)}
            >
              {VOICE_PARTS.map((part) => (
                <option key={part} value={part}>
                  {VOICE_PART_LABEL[part]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <UserRound className="h-4 w-4" aria-hidden />
          <span>{member.email || user?.email || 'Conta local'}</span>
          <span>·</span>
          <span>ID {member.id.slice(0, 12)}…</span>
        </div>
        <Button onClick={() => void save()} loading={saving} className="mt-4 w-full sm:w-auto">
          Salvar alterações
        </Button>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          O naipe define quais salas de chat você pode acessar. O papel de regente só é concedido
          pelo servidor a partir da lista de e-mails autorizada.
        </p>
      </Card>

      <Card>
        <SectionTitle
          title="Armazenamento offline"
          subtitle="Faixas baixadas ficam no IndexedDB deste dispositivo"
          action={<Badge tone="brand">{bytesToSize(cacheSize)}</Badge>}
        />
        <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden />
          <span>
            O espaço disponível depende do navegador e do aparelho. Em celulares, o sistema pode
            remover caches quando o armazenamento estiver baixo. Baixe novamente se a faixa não
            abrir offline.
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void clearCache()}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Apagar cache offline
          </Button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Privacidade e segurança" subtitle="Escopos, retenção e limites" />
        <div className="space-y-3 text-xs leading-relaxed text-slate-400">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden />
            <span>
              Login apenas com Google, escopos básicos de perfil e e-mail. Nenhum token de serviço
              ou segredo é embutido no aplicativo. O Firebase Web usa identificadores públicos
              restritos por domínio.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden />
            <span>
              Faixas, PDFs e áudios de chat são privados do coral. Áudios de chat expiram em{' '}
              {RETENTION_DAYS.chat} dias. A gravação de overdub e o afinador não são enviados ao
              servidor.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden />
            <span>
              Para instalar no Windows, abra o site no Edge ou Chrome e escolha “Instalar
              aplicativo”. Isso cria um atalho com janela própria; não é um arquivo .exe.
            </span>
          </p>
        </div>

        {mode === 'firebase' ? (
          <Button
            variant="danger"
            className="mt-4 w-full"
            onClick={() => void deleteAccount()}
            loading={deleting}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Apagar minha conta e dados
          </Button>
        ) : null}
      </Card>

      {mode === 'demo' ? (
        <Card>
          <SectionTitle title="Modo demonstração" subtitle="Troque de papel para testar permissões" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant={member.role === 'regente' ? 'primary' : 'secondary'}
              onClick={() => signInDemo('regente')}
            >
              Entrar como regente
            </Button>
            <Button
              variant={member.role === 'coralista' ? 'primary' : 'secondary'}
              onClick={() => signInDemo('coralista')}
            >
              Entrar como coralista
            </Button>
          </div>
          <p className={cn('mt-2 text-[11px] leading-relaxed text-slate-500')}>
            No modo demo não há Firebase: os dados são compartilhados apenas neste navegador e as
            permissões são simuladas na interface. As regras reais só valem com o Firebase
            configurado.
          </p>
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="Sobre" subtitle="Identidade e apoio" />
        <dl className="space-y-1 text-xs text-slate-400">
          <div className="flex justify-between gap-3">
            <dt>Produto</dt>
            <dd className="text-slate-200">{APP_NAME}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Versão</dt>
            <dd className="text-slate-200">{APP_VERSION}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>UUID de marca</dt>
            <dd className="break-all text-right font-mono text-[10px] text-slate-300">{APP_UUID}</dd>
          </div>
        </dl>
        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-brand-300 hover:underline"
        >
          Repositório no GitHub
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
        <div className="mt-4">
          <PixButton compact />
        </div>
      </Card>

      <Button variant="danger" onClick={() => void signOut()} className="w-full">
        <LogOut className="h-4 w-4" aria-hidden />
        Sair
      </Button>
    </div>
  );
}
