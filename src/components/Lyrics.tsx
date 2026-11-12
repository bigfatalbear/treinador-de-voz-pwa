import { useMemo } from 'react';
import { Music3 } from 'lucide-react';
import { activeLyricIndex, parseLrc } from '../lib/lrc';
import { cn } from '../lib/utils';

export function Lyrics({
  lrc,
  time,
  onSeek
}: {
  lrc?: string;
  time: number;
  onSeek?: (seconds: number) => void;
}) {
  const lines = useMemo(() => parseLrc(lrc || ''), [lrc]);
  const active = activeLyricIndex(lines, time);

  if (lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
        <Music3 className="mx-auto h-5 w-5 text-slate-600" aria-hidden />
        <p className="mt-2 text-xs text-slate-500">
          O regente ainda não cadastrou a letra sincronizada desta faixa.
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-64 space-y-1 overflow-y-auto pr-1" aria-label="Letra sincronizada">
      {lines.map((line, index) => {
        const isActive = index === active;
        return (
          <button
            key={`${line.time}-${index}`}
            type="button"
            onClick={() => onSeek?.(line.time)}
            className={cn(
              'block w-full rounded-xl px-3 py-2 text-left text-sm leading-relaxed transition',
              isActive
                ? 'bg-brand-500/15 font-medium text-brand-100'
                : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
            )}
            aria-current={isActive ? 'true' : undefined}
          >
            {line.text || '—'}
          </button>
        );
      })}
    </div>
  );
}
