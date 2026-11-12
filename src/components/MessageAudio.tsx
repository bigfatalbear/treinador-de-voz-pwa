import { useEffect, useState } from 'react';
import { LoaderCircle, Volume2 } from 'lucide-react';
import { resolveMediaUrl } from '../lib/media';

export function MessageAudio({ path }: { path: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setUrl('');
    setError('');
    resolveMediaUrl(path)
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch(() => {
        if (active) setError('Áudio indisponível.');
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (error) {
    return (
      <p className="flex items-center gap-2 text-xs text-rose-300">
        <Volume2 className="h-4 w-4" aria-hidden />
        {error}
      </p>
    );
  }

  if (!url) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
        Carregando áudio…
      </p>
    );
  }

  return <audio src={url} controls preload="metadata" className="w-full max-w-sm" />;
}
