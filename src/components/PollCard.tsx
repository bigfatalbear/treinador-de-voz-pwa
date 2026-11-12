import { useEffect, useState } from 'react';
import { CalendarDays, Check, Trash2, Users } from 'lucide-react';
import { paths, setDocument, watchCollection, type WithId } from '../lib/store';
import { VOTE_LABEL, VOTE_VALUES, type Member, type Poll, type Vote, type VoteValue } from '../types';
import { formatDate } from '../lib/utils';
import { Badge, Button } from './ui';
import { useToast } from '../context/ToastContext';

export function PollCard({
  poll,
  member,
  isRegent,
  onDelete
}: {
  poll: WithId<Poll>;
  member: Member;
  isRegent: boolean;
  onDelete: () => void;
}) {
  const [votes, setVotes] = useState<WithId<Vote>[]>([]);
  const [saving, setSaving] = useState<VoteValue | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    return watchCollection<Vote>(paths.votes(poll.id), setVotes, 'updatedAt');
  }, [poll.id]);

  const counts = VOTE_VALUES.reduce<Record<VoteValue, number>>(
    (accumulator, value) => {
      accumulator[value] = votes.filter((vote) => vote.value === value).length;
      return accumulator;
    },
    { sim: 0, nao: 0, talvez: 0 }
  );
  const mine = votes.find((vote) => vote.id === member.id);

  const vote = async (value: VoteValue) => {
    setSaving(value);
    try {
      await setDocument<Omit<Vote, 'id'>>(paths.votes(poll.id), member.id, {
        value,
        name: member.name,
        updatedAt: Date.now()
      });
      notify('Presença registrada.', 'success');
    } catch {
      notify('Não foi possível registrar seu voto.', 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-ink-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{poll.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            {formatDate(poll.eventDate)}
          </p>
        </div>
        {isRegent ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
            aria-label={`Apagar enquete ${poll.title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="accent">
          <Check className="h-3 w-3" aria-hidden /> {counts.sim} confirmados
        </Badge>
        <Badge tone="warn">{counts.talvez} talvez</Badge>
        <Badge tone="danger">{counts.nao} não podem</Badge>
        <Badge tone="neutral">
          <Users className="h-3 w-3" aria-hidden /> {votes.length} respostas
        </Badge>
      </div>

      {mine ? (
        <p className="mt-3 text-xs text-slate-400">
          Sua resposta: <span className="font-medium text-slate-200">{VOTE_LABEL[mine.value]}</span>
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {VOTE_VALUES.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={mine?.value === value ? 'primary' : 'secondary'}
            loading={saving === value}
            onClick={() => void vote(value)}
          >
            {VOTE_LABEL[value]}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Seu voto fica salvo e pode ser alterado enquanto a enquete existir.
      </p>
    </div>
  );
}
