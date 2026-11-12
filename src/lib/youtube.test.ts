import { describe, expect, it } from 'vitest';
import { parseYouTubeId, youtubeEmbedUrl, youtubeThumbnailUrl } from './youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it('aceita as formas mais usadas de link do YouTube', () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://youtu.be/${ID}?si=abc`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`music.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYouTubeId(ID)).toBe(ID);
  });

  it('rejeita links de outros sites e IDs inválidos', () => {
    expect(parseYouTubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTubeId('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTubeId('https://youtu.be/curto')).toBeNull();
    expect(parseYouTubeId('')).toBeNull();
  });
});

describe('URLs de incorporação', () => {
  it('usa o domínio de privacidade e a miniatura oficial', () => {
    expect(youtubeEmbedUrl(ID)).toContain('youtube-nocookie.com/embed/');
    expect(youtubeThumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  });
});
