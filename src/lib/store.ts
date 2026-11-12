import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData
} from 'firebase/firestore';
import { CHOIR_ID } from './branding';
import { db, isFirebaseConfigured } from './firebase';
import type { Member, Message, Notice, Poll, Room, Track, Warmup } from '../types';
import { newId } from './utils';

export type WithId<T> = T & { id: string };

export const choirPath = `choirs/${CHOIR_ID}`;

export const paths = {
  root: choirPath,
  members: `${choirPath}/members`,
  member: (uid: string) => `${choirPath}/members/${uid}`,
  notices: `${choirPath}/notices`,
  tracks: `${choirPath}/tracks`,
  scores: `${choirPath}/scores`,
  warmups: `${choirPath}/warmups`,
  polls: `${choirPath}/polls`,
  votes: (pollId: string) => `${choirPath}/polls/${pollId}/votes`,
  room: (room: Room) => `${choirPath}/rooms/${room}/messages`
};

const listeners = new Map<string, Set<(rows: unknown[]) => void>>();
const LOCAL_PREFIX = 'tdv:store:';
let crossTabInstalled = false;

function installCrossTabListener() {
  if (crossTabInstalled || typeof window === 'undefined') return;
  crossTabInstalled = true;
  window.addEventListener('storage', (event) => {
    if (!event.key || !event.key.startsWith(LOCAL_PREFIX)) return;
    const path = event.key.slice(LOCAL_PREFIX.length);
    notifyLocal(path);
  });
}

function readLocal<T>(path: string): T[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_PREFIX}${path}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(path: string, rows: T[]): void {
  localStorage.setItem(`${LOCAL_PREFIX}${path}`, JSON.stringify(rows));
  notifyLocal(path);
}

function notifyLocal(path: string): void {
  const rows = readLocal<unknown>(path);
  listeners.get(path)?.forEach((listener) => listener(rows));
}

function localWatch<T>(path: string, callback: (rows: WithId<T>[]) => void): () => void {
  installCrossTabListener();
  const listener = (rows: unknown[]) => callback(rows as WithId<T>[]);
  const set = listeners.get(path) ?? new Set();
  set.add(listener);
  listeners.set(path, set);
  callback(readLocal<WithId<T>>(path));
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(path);
  };
}

export function watchCollection<T>(
  path: string,
  callback: (rows: WithId<T>[]) => void,
  orderField = 'createdAt'
): () => void {
  if (!isFirebaseConfigured || !db) return localWatch<T>(path, callback);
  try {
    const reference = query(collection(db, path), orderBy(orderField, 'asc'));
    return onSnapshot(
      reference,
      (snapshot) => {
        callback(
          snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as T) })) as WithId<T>[]
        );
      },
      (error) => {
        console.error(`Falha ao observar ${path}`, error);
      }
    );
  } catch (error) {
    console.error(`Falha ao montar consulta de ${path}`, error);
    return () => undefined;
  }
}

export async function addDocument<T extends object>(path: string, data: T): Promise<string> {
  if (!isFirebaseConfigured || !db) {
    const rows = readLocal<WithId<T>>(path);
    const id = newId();
    const row = {
      ...data,
      id,
      createdAt: 'createdAt' in data ? (data as { createdAt?: unknown }).createdAt : Date.now()
    } as WithId<T>;
    writeLocal(path, [...rows, row]);
    return id;
  }
  const reference = await addDoc(collection(db, path), {
    ...data,
    createdAt: serverTimestamp()
  });
  return reference.id;
}

export async function setDocument<T extends object>(
  path: string,
  id: string,
  data: T,
  merge = true
): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    const rows = readLocal<WithId<T>>(path);
    const index = rows.findIndex((row) => row.id === id);
    if (index >= 0) {
      rows[index] = merge ? { ...rows[index], ...data, id } : ({ ...data, id } as WithId<T>);
    } else {
      rows.push({ ...data, id, createdAt: Date.now() } as WithId<T>);
    }
    writeLocal(path, rows);
    return;
  }
  await setDoc(doc(db, path, id), data as DocumentData, { merge });
}

export async function updateDocument<T extends object>(
  path: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    const rows = readLocal<WithId<T>>(path);
    const index = rows.findIndex((row) => row.id === id);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...data, id };
      writeLocal(path, rows);
    }
    return;
  }
  await updateDoc(doc(db, path, id), data as DocumentData);
}

export async function removeDocument(path: string, id: string): Promise<void> {
  if (!isFirebaseConfigured || !db) {
    const rows = readLocal<{ id: string }>(path).filter((row) => row.id !== id);
    writeLocal(path, rows);
    return;
  }
  await deleteDoc(doc(db, path, id));
}

export async function getMember(uid: string): Promise<Member | null> {
  if (!isFirebaseConfigured || !db) {
    return readLocal<Member>(paths.members).find((member) => member.id === uid) ?? null;
  }
  const snapshot = await getDoc(doc(db, paths.member(uid)));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Omit<Member, 'id'>) };
}

export async function saveMember(uid: string, data: Partial<Member>): Promise<void> {
  await setDocument<Partial<Member>>(paths.members, uid, data, true);
}

const DEMO_TRACK_ID = 'demo-acordes';
const DEMO_POLL_ID = 'demo-ensaio';

function seedIfEmpty<T>(path: string, rows: T[]): void {
  if (readLocal(path).length > 0) return;
  writeLocal(path, rows);
}

export function ensureLocalSeed(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('tdv:seed:v1')) return;
  localStorage.setItem('tdv:seed:v1', '1');
  const now = Date.now();

  seedIfEmpty<Member>(paths.members, [
    {
      id: 'demo-regente',
      name: 'Regente Demo',
      email: 'regente@demo.local',
      role: 'regente',
      voicePart: 'soprano',
      createdAt: now
    },
    {
      id: 'demo-coralista',
      name: 'Coralista Demo',
      email: 'coralista@demo.local',
      role: 'coralista',
      voicePart: 'contralto',
      createdAt: now
    }
  ]);

  const demoTrack: WithId<Track> = {
    id: DEMO_TRACK_ID,
    title: 'Acordes guia (demonstração)',
    composer: 'TREINADOR DE VOZ',
    bpm: 100,
    demo: true,
    parts: {},
    lyrics:
      '[00:00.00]Dó maior — ouça as vozes\n[00:02.00]Lá menor\n[00:04.00]Fá maior\n[00:06.00]Sol maior',
    createdAt: now
  };
  seedIfEmpty(paths.tracks, [demoTrack]);

  seedIfEmpty<Notice>(paths.notices, [
    {
      id: 'aviso-bem-vindo',
      title: 'Bem-vindo ao TREINADOR DE VOZ',
      body: 'Este é o modo demonstração. Explore o mixer, o looping A-B, o afinador e o chat. Quando o Firebase estiver configurado, os dados passam a ser compartilhados com o coral.',
      authorName: 'Equipe',
      pinned: true,
      createdAt: now
    },
    {
      id: 'aviso-ensaio',
      title: 'Ensaio de quinta',
      body: 'Ensaio às 19h30 no salão. Leve sua garrafa de água e chegue 10 minutos antes para o aquecimento.',
      authorName: 'Regente Demo',
      pinned: false,
      createdAt: now - 86400000
    }
  ]);

  const poll: WithId<Poll> = {
    id: DEMO_POLL_ID,
    title: 'Ensaio de quinta-feira',
    eventDate: new Date(now + 3 * 86400000).toISOString().slice(0, 10),
    authorName: 'Regente Demo',
    createdAt: now
  };
  seedIfEmpty(paths.polls, [poll]);
  seedIfEmpty(paths.votes(DEMO_POLL_ID), [
    { id: 'demo-coralista', value: 'sim', name: 'Coralista Demo', updatedAt: now }
  ]);

  seedIfEmpty<Warmup>(paths.warmups, [
    {
      id: 'aquecimento-demo',
      title: 'Aquecimento guiado',
      description: 'O regente pode enviar um áudio curto de aquecimento nesta área.',
      audioPath: '',
      category: 'Aquecimento',
      createdAt: now
    }
  ]);

  const rooms: Room[] = ['geral', 'soprano', 'contralto', 'tenor', 'baixo'];
  for (const room of rooms) {
    const message: WithId<Message> = {
      id: `boas-vindas-${room}`,
      room,
      text:
        room === 'geral'
          ? 'Bem-vindo ao chat geral do coral. Use as salas por naipe para dúvidas específicas.'
          : `Esta é a sala do naipe ${room}. Combine passagens e tire dúvidas com o grupo.`,
      authorId: 'demo-regente',
      authorName: 'Regente Demo',
      createdAt: now
    };
    seedIfEmpty(paths.room(room), [message]);
  }
}
