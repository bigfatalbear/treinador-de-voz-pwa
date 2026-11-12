import { useEffect, useRef, useState } from 'react';
import { Mic, RotateCcw, Square, Trash2 } from 'lucide-react';
import { Button, ProgressBar } from './ui';
import { formatTime } from '../lib/utils';

interface AudioRecorderProps {
  maxSeconds: number;
  onRecorded: (blob: Blob, seconds: number) => void;
  onClear?: () => void;
  onStart?: () => void;
  label?: string;
}

function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function AudioRecorder({
  maxSeconds,
  onRecorded,
  onClear,
  onStart,
  label = 'Gravar áudio'
}: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (stopTimeoutRef.current !== null) window.clearTimeout(stopTimeoutRef.current);
    timerRef.current = null;
    stopTimeoutRef.current = null;
  };

  useEffect(
    () => () => {
      stopTimer();
      cleanupStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  const start = async () => {
    setError('');
    onStart?.();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const elapsed = Math.max(0.2, (Date.now() - startedAtRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setSeconds(elapsed);
        setRecording(false);
        stopTimer();
        cleanupStream();
        onRecorded(blob, elapsed);
      };
      startedAtRef.current = Date.now();
      recorder.start(250);
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds(Math.min(maxSeconds, (Date.now() - startedAtRef.current) / 1000));
      }, 200);
      stopTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, maxSeconds * 1000);
    } catch (mediaError) {
      const name = (mediaError as { name?: string }).name;
      setError(
        name === 'NotAllowedError'
          ? 'Permissão de microfone negada.'
          : 'Não foi possível iniciar a gravação.'
      );
      cleanupStream();
      setRecording(false);
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setSeconds(0);
    onClear?.();
  };

  return (
    <div className="space-y-2">
      {!recording && !previewUrl ? (
        <Button variant="secondary" onClick={start} className="w-full">
          <Mic className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      ) : null}

      {recording ? (
        <div className="space-y-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3">
          <div className="flex items-center justify-between text-xs text-rose-100">
            <span className="flex items-center gap-2 font-medium">
              <span className="h-2 w-2 animate-pulseSoft rounded-full bg-rose-400" />
              Gravando…
            </span>
            <span className="font-mono">
              {formatTime(seconds)} / {formatTime(maxSeconds)}
            </span>
          </div>
          <ProgressBar value={seconds / maxSeconds} />
          <Button variant="danger" size="sm" onClick={stop} className="w-full">
            <Square className="h-3.5 w-3.5" aria-hidden />
            Parar gravação
          </Button>
        </div>
      ) : null}

      {previewUrl ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <audio src={previewUrl} controls className="w-full" />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => {
                discard();
                void start();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Regravar
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" onClick={discard}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Descartar
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
