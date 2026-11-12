import { useState } from 'react';
import { ExternalLink, Play, Plus, Trash2, Video } from 'lucide-react';
import type { TrainingVideo, VoicePart } from '../types';
import { VOICE_PARTS, VOICE_PART_LABEL } from '../types';
import { parseYouTubeId, youtubeEmbedUrl, youtubeThumbnailUrl } from '../lib/youtube';
import { addDocument, paths, removeDocument, type WithId } from '../lib/store';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, SectionTitle, Select, TextArea } from './ui';

function partLabel(video: TrainingVideo): string {
  return video.voicePart ? VOICE_PART_LABEL[video.voicePart] : 'Todos os naipes';
}

function VideoCard({
  video,
  onOpen
}: {
  video: WithId<TrainingVideo>;
  onOpen: (video: TrainingVideo) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(video)}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 text-left transition hover:border-brand-400/40 hover:bg-brand-500/5"
    >
      <span className="relative block aspect-video overflow-hidden bg-ink-950">
        <img
          src={youtubeThumbnailUrl(video.youtubeId)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover opacity-80 transition group-hover:scale-[1.02] group-hover:opacity-100"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-ink-950/20">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-950/80 text-brand-200 ring-1 ring-white/20 transition group-hover:bg-brand-500 group-hover:text-ink-950">
            <Play className="ml-0.5 h-5 w-5" aria-hidden />
          </span>
        </span>
      </span>
      <span className="block space-y-1 p-3">
        <span className="block truncate text-sm font-semibold text-slate-100">{video.title}</span>
        <span className="flex flex-wrap gap-1.5">
          <Badge tone="brand">{video.category}</Badge>
          <Badge tone={video.voicePart ? 'accent' : 'neutral'}>{partLabel(video)}</Badge>
        </span>
        {video.description ? (
          <span className="line-clamp-2 block text-[11px] leading-relaxed text-slate-500">
            {video.description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function VideoPlayerModal({
  video,
  onClose
}: {
  video: TrainingVideo | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(video)}
      onClose={onClose}
      title={video?.title || 'Vídeo de treino'}
      className="sm:max-w-3xl"
    >
      {video ? (
        <div className="space-y-3">
          <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
            <iframe
              src={youtubeEmbedUrl(video.youtubeId)}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="brand">{video.category}</Badge>
              <Badge tone={video.voicePart ? 'accent' : 'neutral'}>{partLabel(video)}</Badge>
            </div>
            {video.description ? (
              <p className="text-xs leading-relaxed text-slate-400">{video.description}</p>
            ) : null}
            <p className="text-[11px] text-slate-600">
              O player é carregado do YouTube somente quando você abre o vídeo.
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-brand-300 underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Abrir no YouTube
            </a>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function VideoLibrary({ videos }: { videos: WithId<TrainingVideo>[] }) {
  const [selected, setSelected] = useState<TrainingVideo | null>(null);
  const ordered = [...videos].reverse();

  return (
    <Card>
      <SectionTitle
        title="Vídeos de treino"
        subtitle="Materiais escolhidos pelo regente para estudar em casa"
        action={<Badge tone="brand">{videos.length}</Badge>}
      />
      {ordered.length === 0 ? (
        <EmptyState
          title="Nenhum vídeo publicado"
          description="O regente pode adicionar links do YouTube com orientações de estudo por naipe."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ordered.map((video) => (
            <VideoCard key={video.id} video={video} onOpen={setSelected} />
          ))}
        </div>
      )}
      <VideoPlayerModal video={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

export function VideoManager({ videos }: { videos: WithId<TrainingVideo>[] }) {
  const { notify } = useToast();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Treino');
  const [voicePart, setVoicePart] = useState<VoicePart | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<TrainingVideo | null>(null);

  const ordered = [...videos].reverse();

  const submit = async () => {
    setError('');
    if (title.trim().length < 2) {
      setError('Informe um título para o vídeo.');
      return;
    }
    const youtubeId = parseYouTubeId(url);
    if (!youtubeId) {
      setError('Informe um link válido do YouTube (watch, youtu.be, shorts ou embed).');
      return;
    }
    setBusy(true);
    try {
      await addDocument<Omit<TrainingVideo, 'id'>>(paths.videos, {
        title: title.trim(),
        description: description.trim(),
        youtubeId,
        category: category.trim() || 'Treino',
        voicePart: voicePart || null
      });
      setTitle('');
      setUrl('');
      setDescription('');
      setCategory('Treino');
      setVoicePart('');
      notify('Vídeo publicado.', 'success');
    } catch {
      setError('Falha ao publicar o vídeo. Verifique a conexão e as permissões.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (video: WithId<TrainingVideo>) => {
    if (!window.confirm(`Apagar o vídeo "${video.title}"?`)) return;
    setError('');
    try {
      await removeDocument(paths.videos, video.id);
      notify('Vídeo apagado.', 'success');
    } catch {
      setError('Falha ao apagar o vídeo.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Novo vídeo de treino"
          subtitle="Cole um link do YouTube e oriente o coral"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Respiração e apoio"
            />
          </Field>
          <Field label="Link do YouTube" hint="Aceita watch, youtu.be, shorts e embed.">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://youtu.be/..."
              inputMode="url"
            />
          </Field>
          <Field label="Categoria">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>Treino</option>
              <option>Técnica vocal</option>
              <option>Repertório</option>
              <option>Naipe</option>
              <option>Ensaio</option>
              <option>Outro</option>
            </Select>
          </Field>
          <Field label="Naipe" hint="Deixe em branco para todos os naipes.">
            <Select
              value={voicePart}
              onChange={(event) => setVoicePart(event.target.value as VoicePart | '')}
            >
              <option value="">Todos os naipes</option>
              {VOICE_PARTS.map((part) => (
                <option key={part} value={part}>
                  {VOICE_PART_LABEL[part]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Orientações">
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="O que o coral deve observar neste vídeo?"
            className="mt-3 min-h-20"
          />
        </Field>
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        <Button onClick={() => void submit()} loading={busy} className="mt-4 w-full">
          <Plus className="h-4 w-4" aria-hidden />
          Publicar vídeo
        </Button>
      </Card>

      <Card>
        <SectionTitle title="Vídeos publicados" action={<Badge tone="brand">{videos.length}</Badge>} />
        {ordered.length === 0 ? (
          <EmptyState
            title="Nenhum vídeo"
            description="Adicione links do YouTube para o coral assistir quando quiser."
          />
        ) : (
          <ul className="space-y-2">
            {ordered.map((video) => (
              <li
                key={video.id}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/60 p-3"
              >
                <Video className="h-4 w-4 shrink-0 text-brand-300" aria-hidden />
                <button
                  type="button"
                  onClick={() => setSelected(video)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {video.title}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {video.category} · {partLabel(video)}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(video)}
                  aria-label={`Apagar vídeo ${video.title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Os vídeos ficam no YouTube e são incorporados sob demanda. O coral precisa de internet para
          assistir; o restante do treino continua disponível offline.
        </p>
      </Card>
      <VideoPlayerModal video={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
