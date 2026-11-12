import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { paths, removeDocument, watchCollection, type WithId } from '../lib/store';
import type { Notice, Poll } from '../types';
import { formatDateTime, toMillis } from '../lib/utils';
import { Badge, Button, Card, EmptyState, SectionTitle } from '../components/ui';
import { PollCard } from '../components/PollCard';

export function Mural() {
  const { member } = useAuth();
  const { notify } = useToast();
  const [notices, setNotices] = useState<WithId<Notice>[]>([]);
  const [polls, setPolls] = useState<WithId<Poll>[]>([]);

  useEffect(() => watchCollection<Notice>(paths.notices, setNotices), []);
  useEffect(() => watchCollection<Poll>(paths.polls, setPolls), []);

  const sortedNotices = useMemo(
    () =>
      [...notices].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return toMillis(b.createdAt) - toMillis(a.createdAt);
      }),
    [notices]
  );

  const isRegent = member?.role === 'regente';

  const deleteNotice = async (notice: WithId<Notice>) => {
    if (!window.confirm(`Apagar o aviso "${notice.title}"?`)) return;
    try {
      await removeDocument(paths.notices, notice.id);
      notify('Aviso apagado.', 'success');
    } catch {
      notify('Não foi possível apagar o aviso.', 'error');
    }
  };

  const deletePoll = async (poll: WithId<Poll>) => {
    if (!window.confirm(`Apagar a enquete "${poll.title}"?`)) return;
    try {
      await removeDocument(paths.polls, poll.id);
      notify('Enquete apagada.', 'success');
    } catch {
      notify('Não foi possível apagar a enquete.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand-300">Mural</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Avisos e presença</h1>
          <p className="mt-1 text-xs text-slate-500">
            Comunicados fixos do regente e confirmação de ensaios e apresentações.
          </p>
        </div>
        {isRegent ? (
          <Link to="/regente">
            <Button size="sm" variant="secondary">
              <Plus className="h-4 w-4" aria-hidden />
              Novo aviso
            </Button>
          </Link>
        ) : null}
      </div>

      <Card>
        <SectionTitle
          title="Avisos"
          subtitle="Comunicados fixos do coral"
          action={<Badge tone="brand">{sortedNotices.length}</Badge>}
        />
        {sortedNotices.length === 0 ? (
          <EmptyState
            title="Nenhum aviso"
            description="Quando o regente publicar um comunicado, ele aparece aqui para todo o coral."
          />
        ) : (
          <ul className="space-y-3">
            {sortedNotices.map((notice) => (
              <li
                key={notice.id}
                className="rounded-3xl border border-white/10 bg-ink-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-accent-300" aria-hidden />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{notice.title}</h3>
                        {notice.pinned ? (
                          <Badge tone="accent">
                            <Pin className="h-3 w-3" aria-hidden />
                            Fixo
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                        {notice.body}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-500">
                        {notice.authorName} · {formatDateTime(notice.createdAt)}
                      </p>
                    </div>
                  </div>
                  {isRegent ? (
                    <button
                      type="button"
                      onClick={() => void deleteNotice(notice)}
                      className="rounded-xl p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                      aria-label={`Apagar aviso ${notice.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="Presença"
          subtitle="Confirme sua participação nos próximos encontros"
          action={<Badge tone="accent">{polls.length}</Badge>}
        />
        {polls.length === 0 ? (
          <EmptyState
            title="Nenhuma enquete de presença"
            description="O regente pode criar enquetes para ensaios e apresentações."
          />
        ) : (
          <div className="space-y-3">
            {polls.map((poll) =>
              member ? (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  member={member}
                  isRegent={Boolean(isRegent)}
                  onDelete={() => void deletePoll(poll)}
                />
              ) : null
            )}
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          A presença é registrada por membro e validada pela RLS. Sem conexão, o voto não é enviado;
          tente novamente quando voltar online.
        </p>
      </Card>
    </div>
  );
}
