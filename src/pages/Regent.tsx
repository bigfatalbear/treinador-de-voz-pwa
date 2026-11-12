import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  FileText,
  Megaphone,
  Mic2,
  Music2,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  addDocument,
  paths,
  removeDocument,
  watchCollection,
  type WithId
} from '../lib/store';
import { CHOIR_ID, LIMITS } from '../lib/branding';
import { deleteStoredFile, uploadFile } from '../lib/media';
import { bytesToSize, cn, newId, sanitizeFileName } from '../lib/utils';
import type { Member, Notice, Poll, Score, Track, VoicePart, Warmup } from '../types';
import { VOICE_PARTS, VOICE_PART_LABEL } from '../types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  ProgressBar,
  SectionTitle,
  Select,
  TextArea
} from '../components/ui';

type Tab = 'faixas' | 'partituras' | 'mural' | 'presenca' | 'aquecimento' | 'membros';

const tabs: Array<{ id: Tab; label: string; icon: typeof Music2 }> = [
  { id: 'faixas', label: 'Faixas', icon: Music2 },
  { id: 'partituras', label: 'Partituras', icon: FileText },
  { id: 'mural', label: 'Mural', icon: Megaphone },
  { id: 'presenca', label: 'Presença', icon: CalendarDays },
  { id: 'aquecimento', label: 'Aquecimento', icon: Mic2 },
  { id: 'membros', label: 'Membros', icon: Users }
];

const emptyFiles: Record<VoicePart, File | null> = {
  soprano: null,
  contralto: null,
  tenor: null,
  baixo: null
};

export function Regent() {
  const { member } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>('faixas');
  const [tracks, setTracks] = useState<WithId<Track>[]>([]);
  const [scores, setScores] = useState<WithId<Score>[]>([]);
  const [warmups, setWarmups] = useState<WithId<Warmup>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);

  useEffect(() => {
    if (member?.role !== 'regente') return;
    const unsubscribers = [
      watchCollection<Track>(paths.tracks, setTracks),
      watchCollection<Score>(paths.scores, setScores),
      watchCollection<Warmup>(paths.warmups, setWarmups),
      watchCollection<Member>(paths.members, setMembers)
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [member?.role]);

  if (!member || member.role !== 'regente') {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <ShieldAlert className="h-8 w-8 text-amber-300" aria-hidden />
          <h1 className="text-lg font-semibold text-white">Área restrita ao regente</h1>
          <p className="max-w-md text-sm text-slate-400">
            Seu papel atual é coralista. O papel de regente é concedido pelo servidor a partir da
            lista de e-mails autorizada.
          </p>
          <Link to="/" className="text-sm text-brand-300 underline">
            Voltar ao treino
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-brand-300">Gestão</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Área do regente</h1>
        <p className="mt-1 text-xs text-slate-500">
          Envie faixas separadas, partituras, avisos, enquetes e aquecimentos. Você também pode
          apagar conteúdos do coral.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Área do regente">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium transition',
                tab === item.id
                  ? 'border-brand-400/50 bg-brand-500/15 text-brand-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'faixas' ? (
        <div className="space-y-4">
          <TrackForm
            onDone={() => {
              setTab('faixas');
              notify('Faixa publicada.', 'success');
            }}
          />
          <Card>
            <SectionTitle title="Faixas publicadas" action={<Badge tone="brand">{tracks.length}</Badge>} />
            {tracks.length === 0 ? (
              <EmptyState title="Nenhuma faixa" description="Envie pelo menos um naipe para publicar." />
            ) : (
              <ul className="space-y-2">
                {tracks.map((track) => (
                  <li
                    key={track.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/60 p-3"
                  >
                    <Music2 className="h-4 w-4 text-brand-300" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{track.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {track.bpm} BPM ·{' '}
                        {VOICE_PARTS.filter((part) => track.parts[part])
                          .map((part) => VOICE_PART_LABEL[part])
                          .join(', ') || 'sem naipes'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm(`Apagar a faixa "${track.title}"?`)) return;
                        void (async () => {
                          await Promise.all(
                            Object.values(track.parts).map((path) => deleteStoredFile(path))
                          );
                          await removeDocument(paths.tracks, track.id);
                          notify('Faixa apagada.', 'success');
                        })();
                      }}
                      aria-label={`Apagar faixa ${track.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'partituras' ? (
        <div className="space-y-4">
          <ScoreForm
            onDone={() => {
              notify('Partitura publicada.', 'success');
            }}
          />
          <Card>
            <SectionTitle title="Partituras" action={<Badge tone="brand">{scores.length}</Badge>} />
            {scores.length === 0 ? (
              <EmptyState title="Nenhuma partitura" description="Envie um PDF para consulta do coral." />
            ) : (
              <ul className="space-y-2">
                {scores.map((score) => (
                  <li
                    key={score.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/60 p-3"
                  >
                    <FileText className="h-4 w-4 text-accent-300" aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-100">{score.title}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm(`Apagar a partitura "${score.title}"?`)) return;
                        void (async () => {
                          await deleteStoredFile(score.pdfPath);
                          await removeDocument(paths.scores, score.id);
                          notify('Partitura apagada.', 'success');
                        })();
                      }}
                      aria-label={`Apagar partitura ${score.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'mural' ? (
        <div className="space-y-4">
          <NoticeForm
            authorName={member.name}
            onDone={() => notify('Aviso publicado.', 'success')}
          />
          <Card>
            <SectionTitle title="Como funciona" />
            <p className="text-xs leading-relaxed text-slate-500">
              Avisos fixos aparecem no topo do mural. Coralistas só podem ler; a escrita é validada
              pelas Security Rules como papel de regente.
            </p>
          </Card>
        </div>
      ) : null}

      {tab === 'presenca' ? (
        <PresenceForm
          authorName={member.name}
          onDone={() => notify('Enquete publicada.', 'success')}
        />
      ) : null}

      {tab === 'aquecimento' ? (
        <div className="space-y-4">
          <WarmupForm onDone={() => notify('Aquecimento publicado.', 'success')} />
          <Card>
            <SectionTitle title="Aquecimentos" action={<Badge tone="brand">{warmups.length}</Badge>} />
            {warmups.length === 0 ? (
              <EmptyState title="Nenhum aquecimento" description="Envie um áudio curto de exercício vocal." />
            ) : (
              <ul className="space-y-2">
                {warmups.map((warmup) => (
                  <li
                    key={warmup.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/60 p-3"
                  >
                    <Mic2 className="h-4 w-4 text-accent-300" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-100">{warmup.title}</p>
                      <p className="text-[11px] text-slate-500">{warmup.category}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm(`Apagar o aquecimento "${warmup.title}"?`)) return;
                        void (async () => {
                          await deleteStoredFile(warmup.audioPath);
                          await removeDocument(paths.warmups, warmup.id);
                          notify('Aquecimento apagado.', 'success');
                        })();
                      }}
                      aria-label={`Apagar aquecimento ${warmup.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'membros' ? (
        <Card>
          <SectionTitle
            title="Membros"
            subtitle="Papéis e naipes são gravados no registro de membro"
            action={<Badge tone="brand">{members.length}</Badge>}
          />
          {members.length === 0 ? (
            <EmptyState title="Nenhum membro" description="Os membros aparecem após entrarem com o código do coral." />
          ) : (
            <ul className="divide-y divide-white/5">
              {members.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.email} · {VOICE_PART_LABEL[item.voicePart]}
                    </p>
                  </div>
                  <Badge tone={item.role === 'regente' ? 'accent' : 'neutral'}>{item.role}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            A lista é somente leitura neste MVP. Novos regentes entram pela lista de e-mails
            configurada no servidor.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function useUploadState() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  return { busy, setBusy, progress, setProgress, error, setError };
}

function TrackForm({ onDone }: { onDone: () => void }) {
  const { notify } = useToast();
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [bpm, setBpm] = useState(100);
  const [lyrics, setLyrics] = useState('');
  const [files, setFiles] = useState<Record<VoicePart, File | null>>(emptyFiles);
  const upload = useUploadState();

  const submit = async () => {
    upload.setError('');
    if (title.trim().length < 2) {
      upload.setError('Informe o título da faixa.');
      return;
    }
    const selected = VOICE_PARTS.filter((part) => files[part]);
    if (selected.length === 0) {
      upload.setError('Envie pelo menos um arquivo de naipe.');
      return;
    }
    for (const part of selected) {
      const file = files[part]!;
      if (file.size > LIMITS.trackFileBytes) {
        upload.setError(`${VOICE_PART_LABEL[part]}: arquivo acima de 25 MB.`);
        return;
      }
      if (file.type && !file.type.startsWith('audio/')) {
        upload.setError(`${VOICE_PART_LABEL[part]}: envie um arquivo de áudio.`);
        return;
      }
    }

    upload.setBusy(true);
    upload.setProgress(0);
    try {
      const parts: Partial<Record<VoicePart, string>> = {};
      let index = 0;
      for (const part of selected) {
        const file = files[part]!;
        const path = `choirs/${CHOIR_ID}/tracks/${newId()}-${part}-${sanitizeFileName(file.name)}`;
        parts[part] = await uploadFile(path, file, (fraction) => {
          upload.setProgress((index + fraction) / selected.length);
        });
        index += 1;
      }
      await addDocument<Omit<Track, 'id'>>(paths.tracks, {
        title: title.trim(),
        composer: composer.trim(),
        bpm,
        lyrics,
        parts
      });
      setTitle('');
      setComposer('');
      setBpm(100);
      setLyrics('');
      setFiles(emptyFiles);
      notify('Faixa publicada.', 'success');
      onDone();
    } catch {
      upload.setError('Falha ao enviar a faixa. Verifique a conexão e as permissões do Storage.');
    } finally {
      upload.setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Nova faixa" subtitle="Stems por naipe, BPM e letra sincronizada" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nome da música" />
        </Field>
        <Field label="Compositor / arranjo">
          <Input value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="BPM de referência" hint="O coralista pode alterar o andamento depois.">
          <Input
            type="number"
            min={LIMITS.bpmMin}
            max={LIMITS.bpmMax}
            value={bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
          />
        </Field>
        <Field label="Letra sincronizada" hint="Formato LRC: [00:12.50]texto da linha">
          <TextArea
            value={lyrics}
            onChange={(event) => setLyrics(event.target.value)}
            placeholder="[00:00.00]Primeira linha"
            className="min-h-24 font-mono text-xs"
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {VOICE_PARTS.map((part) => (
          <label
            key={part}
            className="rounded-2xl border border-white/10 bg-ink-900/60 p-3 text-xs text-slate-300"
          >
            <span className="flex items-center justify-between">
              <span className="font-medium">{VOICE_PART_LABEL[part]}</span>
              <span className="text-[10px] text-slate-500">
                {files[part] ? bytesToSize(files[part]!.size) : 'MP3/M4A/OGG'}
              </span>
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={(event) => setFiles((current) => ({ ...current, [part]: event.target.files?.[0] || null }))}
              className="mt-2 block w-full text-[11px] text-slate-400 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-500/20 file:px-3 file:py-2 file:text-[11px] file:font-medium file:text-brand-100"
            />
          </label>
        ))}
      </div>

      {upload.busy ? (
        <div className="mt-3 space-y-1">
          <ProgressBar value={upload.progress} />
          <p className="text-[11px] text-slate-500">Enviando faixas…</p>
        </div>
      ) : null}
      {upload.error ? <p className="mt-2 text-xs text-rose-300">{upload.error}</p> : null}

      <Button onClick={() => void submit()} loading={upload.busy} className="mt-4 w-full">
        <Upload className="h-4 w-4" aria-hidden />
        Publicar faixa
      </Button>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Limite de 25 MB por stem. O servidor valida tipo e tamanho; o cliente também bloqueia
        arquivos maiores. Faixas ficam privadas e exigem autenticação.
      </p>
    </Card>
  );
}

function ScoreForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadState();

  const submit = async () => {
    upload.setError('');
    if (title.trim().length < 2 || !file) {
      upload.setError('Informe o título e selecione um PDF.');
      return;
    }
    if (file.size > LIMITS.scoreFileBytes) {
      upload.setError('PDF acima de 10 MB.');
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      upload.setError('Envie um arquivo PDF.');
      return;
    }
    upload.setBusy(true);
    upload.setProgress(0.2);
    try {
      const path = `choirs/${CHOIR_ID}/scores/${newId()}-${sanitizeFileName(file.name)}`;
      const pdfPath = await uploadFile(path, file, upload.setProgress);
      await addDocument<Omit<Score, 'id'>>(paths.scores, { title: title.trim(), pdfPath });
      setTitle('');
      setFile(null);
      onDone();
    } catch {
      upload.setError('Falha ao enviar a partitura.');
    } finally {
      upload.setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Nova partitura" subtitle="PDF privado para consulta do coral" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nome da partitura" />
        </Field>
        <Field label="Arquivo PDF" hint="Até 10 MB.">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-500/20 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-100"
          />
        </Field>
      </div>
      {upload.busy ? <div className="mt-3"><ProgressBar value={upload.progress} /></div> : null}
      {upload.error ? <p className="mt-2 text-xs text-rose-300">{upload.error}</p> : null}
      <Button onClick={() => void submit()} loading={upload.busy} className="mt-4 w-full">
        <Upload className="h-4 w-4" aria-hidden />
        Publicar partitura
      </Button>
    </Card>
  );
}

function NoticeForm({ authorName, onDone }: { authorName: string; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (title.trim().length < 2 || body.trim().length < 2) {
      setError('Preencha título e texto do aviso.');
      return;
    }
    setBusy(true);
    try {
      await addDocument<Omit<Notice, 'id'>>(paths.notices, {
        title: title.trim(),
        body: body.trim(),
        authorName,
        pinned
      });
      setTitle('');
      setBody('');
      onDone();
    } catch {
      setError('Falha ao publicar o aviso.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Novo aviso" subtitle="Comunicado fixo no mural" />
      <div className="space-y-3">
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Ensaio de quinta" />
        </Field>
        <Field label="Texto">
          <TextArea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Detalhes do comunicado" />
        </Field>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(event) => setPinned(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-ink-900"
          />
          Fixar no topo do mural
        </label>
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        <Button onClick={() => void submit()} loading={busy} className="w-full">
          <Plus className="h-4 w-4" aria-hidden />
          Publicar aviso
        </Button>
      </div>
    </Card>
  );
}

function PresenceForm({ authorName, onDone }: { authorName: string; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (title.trim().length < 2) {
      setError('Informe o título da enquete.');
      return;
    }
    setBusy(true);
    try {
      await addDocument<Omit<Poll, 'id'>>(paths.polls, {
        title: title.trim(),
        eventDate,
        authorName
      });
      setTitle('');
      onDone();
    } catch {
      setError('Falha ao criar a enquete.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Nova enquete de presença" subtitle="Confirmação para ensaio ou apresentação" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Ensaio de quinta" />
        </Field>
        <Field label="Data">
          <Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
        </Field>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
      <Button onClick={() => void submit()} loading={busy} className="mt-4 w-full">
        <CalendarDays className="h-4 w-4" aria-hidden />
        Publicar enquete
      </Button>
    </Card>
  );
}

function WarmupForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Aquecimento');
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadState();

  const submit = async () => {
    upload.setError('');
    if (title.trim().length < 2 || !file) {
      upload.setError('Informe o título e selecione um áudio.');
      return;
    }
    if (file.size > LIMITS.trackFileBytes) {
      upload.setError('Áudio acima de 25 MB.');
      return;
    }
    if (file.type && !file.type.startsWith('audio/')) {
      upload.setError('Envie um arquivo de áudio.');
      return;
    }
    upload.setBusy(true);
    upload.setProgress(0);
    try {
      const path = `choirs/${CHOIR_ID}/warmups/${newId()}-${sanitizeFileName(file.name)}`;
      const audioPath = await uploadFile(path, file, upload.setProgress);
      await addDocument<Omit<Warmup, 'id'>>(paths.warmups, {
        title: title.trim(),
        description: description.trim(),
        category,
        audioPath
      });
      setTitle('');
      setDescription('');
      setFile(null);
      onDone();
    } catch {
      upload.setError('Falha ao enviar o aquecimento.');
    } finally {
      upload.setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Novo aquecimento" subtitle="Exercício vocal em áudio" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Vibrato lento" />
        </Field>
        <Field label="Categoria">
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>Aquecimento</option>
            <option>Respiração</option>
            <option>Vocalize</option>
            <option>Relaxamento</option>
          </Select>
        </Field>
        <Field label="Descrição">
          <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Áudio" hint="Até 25 MB.">
          <input
            type="file"
            accept="audio/*"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-500/20 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-100"
          />
        </Field>
      </div>
      {upload.busy ? <div className="mt-3"><ProgressBar value={upload.progress} /></div> : null}
      {upload.error ? <p className="mt-2 text-xs text-rose-300">{upload.error}</p> : null}
      <Button onClick={() => void submit()} loading={upload.busy} className="mt-4 w-full">
        <Upload className="h-4 w-4" aria-hidden />
        Publicar aquecimento
      </Button>
    </Card>
  );
}
