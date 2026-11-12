const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function validId(value: string | null | undefined): string | null {
  const id = (value || '').trim();
  return VIDEO_ID.test(id) ? id : null;
}

export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const direct = validId(value);
  if (direct) return direct;

  const withProtocol = /^[a-z][\w+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') {
      return validId(url.pathname.split('/').filter(Boolean)[0]);
    }
    if (host !== 'youtube.com' && host !== 'youtube-nocookie.com' && !host.endsWith('.youtube.com')) {
      return null;
    }
    if (url.pathname === '/watch') {
      return validId(url.searchParams.get('v'));
    }
    const pathMatch = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
    return pathMatch ? validId(pathMatch[1]) : null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}

export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
