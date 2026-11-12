import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { isFirebaseConfigured, storage, callFunction } from './firebase';
import { newId } from './utils';

const objectUrls = new Map<string, string>();

export interface UploadProgress {
  (fraction: number): void;
}

export async function uploadFile(
  path: string,
  file: Blob,
  onProgress?: UploadProgress
): Promise<string> {
  if (!isFirebaseConfigured || !storage) {
    const key = `upload:${newId()}`;
    await idbSet(key, file);
    onProgress?.(1);
    return `demo://${key}`;
  }
  const target = ref(storage, path);
  const task = uploadBytesResumable(target, file, {
    contentType: file.type || 'application/octet-stream'
  });
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
        }
      },
      reject,
      () => resolve()
    );
  });
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
  if (!isFirebaseConfigured || !storage) {
    throw new Error('Armazenamento não configurado.');
  }
  try {
    const result = await callFunction<{ url: string }>('getMediaUrl', { path });
    if (result?.url) return result.url;
  } catch (error) {
    console.warn('getMediaUrl indisponível; usando URL do SDK do Storage.', error);
  }
  return getDownloadURL(ref(storage, path));
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
  if (!isFirebaseConfigured || !storage) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    console.warn('Falha ao apagar arquivo do Storage.', error);
  }
}
