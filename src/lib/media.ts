import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { isSupabaseConfigured, mediaBucket, supabase } from './supabase';
import { newId } from './utils';

const objectUrls = new Map<string, string>();
const signedUrls = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_SECONDS = 900;

export interface UploadProgress {
  (fraction: number): void;
}

export async function uploadFile(
  path: string,
  file: Blob,
  onProgress?: UploadProgress
): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    const key = `upload:${newId()}`;
    await idbSet(key, file);
    onProgress?.(1);
    return `demo://${key}`;
  }

  onProgress?.(0.1);
  const { error } = await supabase.storage.from(mediaBucket).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });
  if (error) throw error;
  onProgress?.(1);
  return path;
}

export async function resolveMediaUrl(path: string | undefined | null): Promise<string> {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  if (path.startsWith('demo://')) {
    const key = path.slice('demo://'.length);
    const cached = objectUrls.get(path);
    if (cached) return cached;
    const blob = await idbGet<Blob>(key);
    if (!blob) throw new Error('Arquivo local não encontrado.');
    const url = URL.createObjectURL(blob);
    objectUrls.set(path, url);
    return url;
  }
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Armazenamento não configurado.');
  }

  const cached = signedUrls.get(path);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.url;

  const { data, error } = await supabase.storage
    .from(mediaBucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw error || new Error('Não foi possível gerar a URL da mídia.');
  signedUrls.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_SECONDS * 1000
  });
  return data.signedUrl;
}

export async function deleteStoredFile(path: string | undefined): Promise<void> {
  if (!path) return;
  if (path.startsWith('demo://')) {
    await idbDel(path.slice('demo://'.length));
    const existing = objectUrls.get(path);
    if (existing) URL.revokeObjectURL(existing);
    objectUrls.delete(path);
    return;
  }
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.storage.from(mediaBucket).remove([path]);
  if (error) console.warn('Falha ao apagar arquivo do Storage.', error);
  signedUrls.delete(path);
}
