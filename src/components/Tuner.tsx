import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { createPitchDetector, noteLabel, type PitchReading } from '../lib/pitch';
import { Button, Card, SectionTitle } from './ui';
import { cn } from '../lib/utils';

export function Tuner() {
  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState<PitchReading | null>(null);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);

  const stop = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setListening(false);
    setReading(null);
  };

  useEffect(() => stop, []);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      const context = new AudioContext();
      if (context.state === 'suspended') await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const detector = createPitchDetector(context.sampleRate);
      streamRef.current = stream;
      contextRef.current = context;
      setListening(true);

      let lastUpdate = 0;
      const loop = (timestamp: number) => {
        if (timestamp - lastUpdate > 80) {
          lastUpdate = timestamp;
          setReading(detector.read(analyser));
        }
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);
    } catch (mediaError) {
      const name = (mediaError as { name?: string }).name;
      setError(
        name === 'NotAllowedError'
          ? 'Permissão de microfone negada. Autorize o microfone no navegador.'
          : 'Não foi possível acessar o microfone.'
      );
      setListening(false);
    }
  };

  const cents = reading?.cents ?? 0;
  const inTune = reading ? Math.abs(cents) < 8 : false;
  const close = reading ? Math.abs(cents) < 22 : false;
  const indicator = Math.max(-50, Math.min(50, cents));

  return (
    <Card>
      <SectionTitle
        title="Afinador"
        subtitle="Cante uma nota sustentada perto do microfone"
        action={
          <Button
            size="sm"
            variant={listening ? 'danger' : 'secondary'}
            onClick={listening ? stop : start}
            aria-pressed={listening}
          >
            {listening ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
            {listening ? 'Parar' : 'Ouvir'}
          </Button>
        }
      />

      <div
        className="rounded-3xl border border-white/10 bg-ink-900/70 px-4 py-5 text-center"
        aria-live="polite"
      >
        <p
          className={cn(
            'font-mono text-5xl font-bold tracking-tight sm:text-6xl',
            !reading && 'text-slate-600',
            reading && inTune && 'text-accent-300',
            reading && !inTune && close && 'text-amber-200',
            reading && !close && 'text-slate-100'
          )}
        >
          {noteLabel(reading)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {reading
            ? `${reading.frequency.toFixed(1)} Hz · ${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents`
            : listening
              ? 'Ouvindo…'
              : 'Afinador parado'}
        </p>

        <div className="relative mx-auto mt-5 h-3 max-w-sm rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/30" />
          <div
            className={cn(
              'absolute top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full transition-all',
              inTune ? 'bg-accent-400' : close ? 'bg-amber-300' : 'bg-rose-400'
            )}
            style={{ left: `calc(${50 + indicator}% - 3px)` }}
          />
        </div>
        <div className="mx-auto mt-1 flex max-w-sm justify-between text-[10px] text-slate-600">
          <span>-50</span>
          <span>0</span>
          <span>+50</span>
        </div>
        {reading && (
          <p className="mt-3 text-xs font-medium text-slate-300">
            {inTune ? 'Afinação excelente.' : cents > 0 ? 'Um pouco acima. Abaixe a afinação.' : 'Um pouco abaixo. Suba a afinação.'}
          </p>
        )}
      </div>

      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        O microfone é processado apenas no seu dispositivo. Nenhum áudio do afinador é enviado
        para servidores.
      </p>
    </Card>
  );
}
