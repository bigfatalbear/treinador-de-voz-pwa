import { del, get, keys, set } from 'idb-keyval';
import { VOICE_PARTS, type Track, type VoicePart } from '../types';
import { resolveMediaUrl } from './media';

function partKey(trackId: string, part: VoicePart): string {
  return `offline:${trackId}:${part}`;
}

export async function getCachedPart(trackId: string, part: VoicePart): Promise<Blob | undefined> {
  try {
    return await get<Blob>(partKey(trackId, part));
  } catch {
    return undefined;
  }
}

export async function isTrackCached(track: Track): Promise<boolean> {
  if (track.demo) return true;
  const parts = VOICE_PARTS.filter((part) => track.parts[part]);
  if (parts.length === 0) return false;
  for (const part of parts) {
    const cached = await getCachedPart(track.id, part);
    if (!cached) return false;
  }
  return true;
}

export async function cacheTrack(
  track: Track,
  onProgress?: (fraction: number) => void
): Promise<void> {
  if (track.demo) {
    onProgress?.(1);
    return;
  }
  const parts = VOICE_PARTS.filter((part) => track.parts[part]);
  let done = 0;
  for (const part of parts) {
    const storagePath = track.parts[part];
    if (!storagePath) continue;
    const cached = await getCachedPart(track.id, part);
    if (!cached) {
      const url = await resolveMediaUrl(storagePath);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Falha ao baixar ${part}.`);
      const blob = await response.blob();
      await set(partKey(track.id, part), blob);
    }
    done += 1;
    onProgress?.(done / parts.length);
  }
}

export async function clearOfflineCache(): Promise<void> {
  const allKeys = await keys();
  await Promise.all(
    allKeys
      .filter((key): key is string => typeof key === 'string' && key.startsWith('offline:'))
      .map((key) => del(key))
  );
}

export async function offlineCacheSize(): Promise<number> {
  const allKeys = await keys();
  let total = 0;
  for (const key of allKeys) {
    if (typeof key !== 'string' || !key.startsWith('offline:')) continue;
    const blob = await get<Blob>(key);
    if (blob) total += blob.size;
  }
  return total;
}
