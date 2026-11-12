import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  FileText,
  Gauge,
  Headphones,
  Music2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { paths, watchCollection, type WithId } from '../lib/store';
import type { Score, Track, TrainingVideo, VoicePart, Warmup } from '../types';
import { VOICE_PARTS, VOICE_PART_LABEL } from '../types';
import { ChoirPlayer } from '../lib/audio';
import { cacheTrack, isTrackCached } from '../lib/cache';
import { resolveMediaUrl } from '../lib/media';
import { formatTime, cn } from '../lib/utils';
import { LIMITS } from '../lib/branding';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  ProgressBar,
  SectionTitle,
  Select,
  Spinner
} from '../components/ui';
import { Tuner } from '../components/Tuner';
import { Lyrics } from '../components/Lyrics';
import { AudioRecorder } from '../components/AudioRecorder';
import { MessageAudio } from '../components/MessageAudio';
import { VideoLibrary } from '../components/TrainingVideos';

const initialVolumes: Record<VoicePart, number> = {
  soprano: 0.8,
  contralto: 0.8,
  tenor: 0.8,
  baixo: 0.8
};

export function Practice() {
  const { member } = useAuth();
  const { notify } = useToast();
  const [tracks, setTracks] = useState<WithId<Track>[]>([]);
  const [scores, setScores] = useState<WithId<Score>[]>([]);
  const [warmups, setWarmups] = useState<WithId<Warmup>[]>([]);
  const [videos, setVideos] = useState<WithId<TrainingVideo>[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bpm, setBpm] = useState<number>(LIMITS.baseBpm);
  const [volumes, setVolumes] = useState<Record<VoicePart, number>>(initialVolumes);
  const [muted, setMuted] = useState<Record<VoicePart, boolean>>({
    soprano: false,
    contralto: false,
    tenor: false,
    baixo: false
  });
  const [master, setMaster] = useState(0.9);
  const [loopA, setLoopA] = useState(0);
  const [loopB, setLoopB] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [cached, setCached] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<number | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreUrl, setScoreUrl] = useState('');
  const [scoreTitle, setScoreTitle] = useState('');
  const [overdubUrl, setOverdubUrl] = useState('');
  const [loadError, setLoadError] = useState('');
  const playerRef = useRef<ChoirPlayer | null>(null);
  const lastVolumesRef = useRef<Record<VoicePart, number>>(initialVolumes);
  const loadTokenRef = useRef(0);

  useEffect(() => watchCollection<Track>(paths.tracks, setTracks), []);
  useEffect(() => watchCollection<Score>(paths.scores, setScores), []);
  useEffect(() => watchCollection<Warmup>(paths.warmups, setWarmups), []);
  useEffect(() => watchCollection<TrainingVideo>(paths.videos, setVideos), []);

  useEffect(() => {
    if (tracks.length === 0) {
      if (selectedId) setSelectedId('');
      return;
    }
    if (!tracks.some((track) => track.id === selectedId)) {
      setSelectedId(tracks[0].id);
    }
  }, [tracks, selectedId]);

  const track = useMemo(
    () => tracks.find((item) => item.id === selectedId) || null,
    [tracks, selectedId]
  );

  useEffect(() => {
    if (!track) return;
    const token = loadTokenRef.current + 1;
    loadTokenRef.current = token;
    setLoadingTrack(true);
    setLoadError('');
    setPlaying(false);
    setPosition(0);

    const engine = new ChoirPlayer();
    const previous = playerRef.current;
    playerRef.current = engine;
    previous?.dispose();

    void (async () => {
      try {
        const trackDuration = await engine.load(track);
        if (token !== loadTokenRef.current) {
          engine.dispose();
          return;
        }
        setDuration(trackDuration);
        setBpm(track.bpm || LIMITS.baseBpm);
        setLoopA(0);
        setLoopB(trackDuration);
        setLoopEnabled(false);
        setCached(await isTrackCached(track));
        for (const part of VOICE_PARTS) {
          engine.setVolume(part, volumes[part]);
        }
        engine.setMaster(master);
      } catch (error) {
        if (token !== loadTokenRef.current) return;
        setLoadError(
          (error as Error).message ||
            'Não foi possível carregar o áudio. Verifique a conexão ou baixe a faixa novamente.'
        );
      } finally {
        if (token === loadTokenRef.current) setLoadingTrack(false);
      }
    })();

    return () => {
      // O player é substituído no próximo carregamento ou descartado no unmount.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  useEffect(() => {
    return () => {
      loadTokenRef.current += 1;
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const loop = () => {
      const engine = playerRef.current;
      if (!engine) return;
      engine.tick();
      setPosition(engine.getPosition());
      if (!engine.isPlaying) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    return () => {
      if (overdubUrl) URL.revokeObjectURL(overdubUrl);
    };
  }, [overdubUrl]);

  const togglePlay = useCallback(async () => {
    const engine = playerRef.current;
    if (!engine) return;
    try {
      if (playing) {
        engine.pause();
        setPlaying(false);
        setPosition(engine.getPosition());
      } else {
        await engine.play();
        setPlaying(true);
      }
    } catch (error) {
      notify((error as Error).message || 'Falha ao reproduzir.', 'error');
    }
  }, [notify, playing]);

  const stop = () => {
    playerRef.current?.stop();
    setPlaying(false);
    setPosition(0);
  };

  const seek = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setPosition(seconds);
  };

  const changeBpm = (value: number) => {
    setBpm(value);
    playerRef.current?.setBpm(value);
  };

  const applyLoop = (a: number, b: number, enabled: boolean) => {
    setLoopA(a);
    setLoopB(b);
    setLoopEnabled(enabled);
    playerRef.current?.setLoop(a, b, enabled);
  };

  const markA = () => {
    const nextB = Math.max(loopB, Math.min(duration, position + 0.5));
    applyLoop(position, nextB, loopEnabled);
    notify(`Ponto A em ${formatTime(position)}.`, 'info');
  };

  const markB = () => {
    if (position <= loopA + 0.3) {
      notify('Marque o ponto B depois do ponto A.', 'error');
      return;
    }
    applyLoop(loopA, position, loopEnabled);
    notify(`Ponto B em ${formatTime(position)}.`, 'info');
  };

  const toggleLoop = () => {
    if (loopB <= loopA + 0.2) {
      notify('Defina um trecho válido entre A e B.', 'error');
      return;
    }
    applyLoop(loopA, loopB, !loopEnabled);
  };

  const changeVolume = (part: VoicePart, value: number) => {
    setVolumes((current) => ({ ...current, [part]: value }));
    setMuted((current) => ({ ...current, [part]: false }));
    playerRef.current?.setVolume(part, value);
    if (value > 0) lastVolumesRef.current[part] = value;
  };

  const toggleMute = (part: VoicePart) => {
    const engine = playerRef.current;
    if (muted[part]) {
      const restore = lastVolumesRef.current[part] || 0.8;
      setVolumes((current) => ({ ...current, [part]: restore }));
      setMuted((current) => ({ ...current, [part]: false }));
      engine?.setVolume(part, restore);
    } else {
      lastVolumesRef.current[part] = volumes[part] || 0.8;
      setVolumes((current) => ({ ...current, [part]: 0 }));
      setMuted((current) => ({ ...current, [part]: true }));
      engine?.setVolume(part, 0);
    }
  };

  const changeMaster = (value: number) => {
    setMaster(value);
    playerRef.current?.setMaster(value);
  };

  const download = async () => {
    if (!track) return;
    setCacheProgress(0);
    try {
      await cacheTrack(track, setCacheProgress);
      setCached(true);
      notify('Faixas disponíveis offline neste dispositivo.', 'success');
    } catch {
      notify('Falha ao baixar. Verifique a conexão e a configuração de CORS do Storage.', 'error');
    } finally {
      setCacheProgress(null);
    }
  };

  const openScore = async (score: WithId<Score>) => {
    try {
      const url = await resolveMediaUrl(score.pdfPath);
      setScoreUrl(url);
      setScoreTitle(score.title);
      setScoreOpen(true);
    } catch {
      notify('Não foi possível abrir a partitura.', 'error');
    }
  };

  const onOverdub = (blob: Blob) => {
    if (overdubUrl) URL.revokeObjectURL(overdubUrl);
    setOverdubUrl(URL.createObjectURL(blob));
  };

  const saveOverdub = () => {
    if (!overdubUrl) return;
    const anchor = document.createElement('a');
    anchor.href = overdubUrl;
    anchor.download = `overdub-${Date.now()}.webm`;
    anchor.click();
    notify('Gravação salva no dispositivo.', 'success');
  };

  const availableParts = track
    ? VOICE_PARTS.filter((part) => track.demo || track.parts[part])
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand-300">Treino</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Olá, {member?.name.split(' ')[0]}.</h1>
          <p className="mt-1 text-xs text-slate-500">
            Naipe {member?.voicePart ? VOICE_PART_LABEL[member.voicePart] : '—'} ·{' '}
            {member?.role === 'regente' ? 'Regente' : 'Coralista'}
          </p>
        </div>
        {track ? (
          <div className="flex items-center gap-2">
            <Badge tone={cached ? 'accent' : 'neutral'}>
              <Download className="h-3 w-3" aria-hidden />
              {cached ? 'Offline' : 'Online'}
            </Badge>
            <Badge tone="brand">{bpm} BPM</Badge>
          </div>
        ) : null}
      </div>

      <Card>
        <SectionTitle
          title="Faixa de treino"
          subtitle="Escolha a música e ajuste o ensaio"
          action={
            member?.role === 'regente' ? (
              <Link to="/regente" className="text-xs font-medium text-brand-300 hover:underline">
                Gerenciar
              </Link>
            ) : null
          }
        />
        {tracks.length === 0 ? (
          <EmptyState
            title="Nenhuma faixa disponível"
            description="Peça ao regente para enviar as faixas separadas por naipe. Enquanto isso, o afinador e o aquecimento continuam disponíveis."
          />
        ) : (
          <div className="space-y-3">
            <Select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              aria-label="Selecionar faixa"
            >
              {tracks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.demo ? ' (demo)' : ''}
                </option>
              ))}
            </Select>

            {loadingTrack ? <Spinner label="Carregando áudio" /> : null}
            {loadError ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                {loadError}
              </div>
            ) : null}

            {track && !loadingTrack ? (
              <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{track.title}</p>
                    <p className="text-xs text-slate-500">
                      {track.composer || 'Sem compositor informado'} · {formatTime(duration)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void download()}
                    loading={cacheProgress !== null}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    {cached ? 'Baixar novamente' : 'Baixar offline'}
                  </Button>
                </div>
                {cacheProgress !== null ? (
                  <div className="mt-3 space-y-1">
                    <ProgressBar value={cacheProgress} />
                    <p className="text-[11px] text-slate-500">
                      Baixando faixas para uso offline…
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void togglePlay()} disabled={!track || loadingTrack} size="lg">
                {playing ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
                {playing ? 'Pausar' : 'Tocar'}
              </Button>
              <Button variant="secondary" onClick={stop} disabled={!track} aria-label="Parar">
                <Square className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant={loopEnabled ? 'primary' : 'secondary'}
                onClick={toggleLoop}
                disabled={!track}
                aria-pressed={loopEnabled}
              >
                <Repeat className="h-4 w-4" aria-hidden />
                Loop A-B
              </Button>
              <Button variant="ghost" size="sm" onClick={markA} disabled={!track}>
                Marcar A
              </Button>
              <Button variant="ghost" size="sm" onClick={markB} disabled={!track}>
                Marcar B
              </Button>
            </div>

            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                step={0.01}
                value={Math.min(position, duration || 1)}
                onChange={(event) => seek(Number(event.target.value))}
                disabled={!track || loadingTrack}
                aria-label="Posição da música"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{formatTime(position)}</span>
                <span>
                  {loopEnabled ? `Loop ${formatTime(loopA)} – ${formatTime(loopB)}` : formatTime(duration)}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-3">
                <label htmlFor="bpm" className="flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Gauge className="h-4 w-4 text-brand-300" aria-hidden />
                    Andamento
                  </span>
                  <span className="font-mono text-brand-200">{bpm} BPM</span>
                </label>
                <input
                  id="bpm"
                  type="range"
                  min={LIMITS.bpmMin}
                  max={LIMITS.bpmMax}
                  step={1}
                  value={bpm}
                  onChange={(event) => changeBpm(Number(event.target.value))}
                  className="mt-3"
                  disabled={!track}
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  O tom é preservado pelo time-stretch no dispositivo.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-3">
                <label htmlFor="master" className="flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Headphones className="h-4 w-4 text-accent-300" aria-hidden />
                    Playback geral
                  </span>
                  <span className="font-mono">{Math.round(master * 100)}%</span>
                </label>
                <input
                  id="master"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={master}
                  onChange={(event) => changeMaster(Number(event.target.value))}
                  className="mt-3"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Volume de saída de todos os naipes juntos.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      <VideoLibrary videos={videos} />

      {track ? (
        <Card>
          <SectionTitle
            title="Mixer de naipes"
            subtitle="Controle o volume de cada voz e do playback"
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {VOICE_PARTS.map((part) => {
              const enabled = availableParts.includes(part);
              return (
                <div
                  key={part}
                  className={cn(
                    'rounded-2xl border border-white/10 bg-ink-900/60 p-3',
                    !enabled && 'opacity-50'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-200">{VOICE_PART_LABEL[part]}</p>
                    <button
                      type="button"
                      onClick={() => toggleMute(part)}
                      disabled={!enabled}
                      className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                      aria-label={`${muted[part] ? 'Reativar' : 'Silenciar'} ${VOICE_PART_LABEL[part]}`}
                    >
                      {muted[part] ? (
                        <VolumeX className="h-4 w-4" aria-hidden />
                      ) : (
                        <Volume2 className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volumes[part]}
                    onChange={(event) => changeVolume(part, Number(event.target.value))}
                    disabled={!enabled}
                    aria-label={`Volume de ${VOICE_PART_LABEL[part]}`}
                    className="mt-3"
                  />
                  <p className="mt-1 text-right text-[10px] text-slate-500">
                    {enabled ? `${Math.round(volumes[part] * 100)}%` : 'Sem faixa'}
                  </p>
                </div>
              );
            })}
            <div className="rounded-2xl border border-accent-400/20 bg-accent-500/5 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-accent-200">Playback</p>
                <SlidersHorizontal className="h-4 w-4 text-accent-300" aria-hidden />
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={master}
                onChange={(event) => changeMaster(Number(event.target.value))}
                aria-label="Volume do playback geral"
                className="mt-3"
              />
              <p className="mt-1 text-right text-[10px] text-slate-500">
                {Math.round(master * 100)}%
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="Letra sincronizada"
            subtitle="Toque em uma linha para pular até o trecho"
          />
          <Lyrics lrc={track?.lyrics} time={position} onSeek={seek} />
        </Card>

        <Card>
          <SectionTitle
            title="Partitura e aquecimento"
            subtitle="PDF para consulta e exercícios enviados pelo regente"
          />
          {scores.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-500">
              Nenhuma partitura cadastrada.
            </p>
          ) : (
            <ul className="space-y-2">
              {scores.map((score) => (
                <li key={score.id}>
                  <button
                    type="button"
                    onClick={() => void openScore(score)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-brand-400/40 hover:bg-brand-500/10"
                  >
                    <FileText className="h-4 w-4 text-brand-300" aria-hidden />
                    <span className="flex-1 text-sm text-slate-200">{score.title}</span>
                    <span className="text-[11px] text-slate-500">Abrir PDF</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aquecimento</p>
            {warmups.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum áudio de aquecimento cadastrado.</p>
            ) : (
              warmups.map((warmup) => (
                <div key={warmup.id} className="rounded-2xl border border-white/10 bg-ink-900/60 p-3">
                  <p className="text-sm font-medium text-slate-200">{warmup.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    {warmup.description || warmup.category}
                  </p>
                  {warmup.audioPath ? (
                    <div className="mt-2">
                      <MessageAudio path={warmup.audioPath} />
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-600">Áudio ainda não enviado.</p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tuner />

        <Card>
          <SectionTitle
            title="Overdub"
            subtitle="Grave sua voz junto com a base e ouça o resultado"
          />
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            A gravação acontece no seu dispositivo e não é enviada ao servidor. Use fones para
            evitar vazamento da base para o microfone.
          </p>
          <AudioRecorder
            maxSeconds={LIMITS.overdubSeconds}
            onRecorded={onOverdub}
            onStart={() => {
              if (!playing) void togglePlay();
            }}
            label="Gravar junto com a base"
          />
          {overdubUrl ? (
            <Button variant="secondary" className="mt-3 w-full" onClick={saveOverdub}>
              <Download className="h-4 w-4" aria-hidden />
              Salvar gravação no dispositivo
            </Button>
          ) : null}
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-500">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden />
            <span>
              O loop A-B e o BPM afetam a base. A gravação é independente e pode ser comparada com
              o playback.
            </span>
          </div>
        </Card>
      </div>

      <p className="flex items-center justify-center gap-2 pb-2 text-[11px] text-slate-600">
        <Music2 className="h-3.5 w-3.5" aria-hidden />
        Faixas, letras e partituras devem ter direitos autorais autorizados pelo coral.
      </p>

      <Modal open={scoreOpen} onClose={() => setScoreOpen(false)} title={scoreTitle || 'Partitura'}>
        {scoreUrl ? (
          <div className="space-y-3">
            <iframe
              src={scoreUrl}
              title={scoreTitle || 'Partitura em PDF'}
              className="h-[65vh] w-full rounded-2xl border border-white/10 bg-white"
            />
            <a
              href={scoreUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-xs text-brand-300 underline"
            >
              Abrir em nova aba
            </a>
          </div>
        ) : (
          <Spinner label="Abrindo partitura" />
        )}
      </Modal>
    </div>
  );
}
