import { CHOIR_ID } from './branding';
import { isSupabaseConfigured, supabase } from './supabase';
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
  videos: `${choirPath}/videos`,
  polls: `${choirPath}/polls`,
  votes: (pollId: string) => `${choirPath}/polls/${pollId}/votes`,
  room: (room: Room) => `${choirPath}/rooms/${room}/messages`
};

const listeners = new Map<string, Set<(rows: unknown[]) => void>>();
const LOCAL_PREFIX = 'tdv:store:';
let crossTabInstalled = false;

const camelToSnake: Record<string, string> = {
  voicePart: 'voice_part',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  authorName: 'author_name',
  authorId: 'author_id',
  audioPath: 'audio_path',
  audioDuration: 'audio_duration',
  eventDate: 'event_date',
  pdfPath: 'pdf_path',
  youtubeId: 'youtube_id'
};

const snakeToCamel: Record<string, string> = Object.fromEntries(
  Object.entries(camelToSnake).map(([camel, snake]) => [snake, camel])
);

interface TableSpec {
  table:
    | 'members'
    | 'notices'
    | 'tracks'
    | 'scores'
    | 'warmups'
    | 'videos'
    | 'polls'
    | 'poll_votes'
    | 'messages';
  filters: Record<string, string>;
  order: string;
  realtimeFilter?: string;
  pollId?: string;
}

function parsePath(path: string): TableSpec {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'choirs') throw new Error(`Caminho inválido: ${path}`);
  const choirId = parts[1] || CHOIR_ID;

  if (parts[2] === 'members') {
    return {
      table: 'members',
      filters: { choir_id: choirId },
      order: 'created_at',
      realtimeFilter: `choir_id=eq.${choirId}`
    };
  }
  if (parts[2] === 'rooms' && parts[4] === 'messages') {
    return {
      table: 'messages',
      filters: { choir_id: choirId, room: parts[3] },
      order: 'created_at',
      realtimeFilter: `room=eq.${parts[3]}`
    };
  }
  if (parts[2] === 'polls' && parts[4] === 'votes') {
    return {
      table: 'poll_votes',
      filters: { poll_id: parts[3] },
      order: 'updated_at',
      realtimeFilter: `poll_id=eq.${parts[3]}`,
      pollId: parts[3]
    };
  }

  const table = parts[2] as TableSpec['table'];
  if (!['notices', 'tracks', 'scores', 'warmups', 'videos', 'polls'].includes(table)) {
    throw new Error(`Coleção desconhecida: ${path}`);
  }
  return {
    table,
    filters: { choir_id: choirId },
    order: 'created_at',
    realtimeFilter: `choir_id=eq.${choirId}`
  };
}

function toRow(data: object): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const column = camelToSnake[key] || key;
    if (column === 'created_at' || column === 'updated_at') {
      row[column] = typeof value === 'number' ? new Date(value).toISOString() : value;
    } else {
      row[column] = value;
    }
  }
  return row;
}

function fromRow<T>(row: Record<string, unknown>, spec: TableSpec): WithId<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'choir_id' || key === 'poll_id') continue;
    const camel = snakeToCamel[key];
    result[camel || key] = value;
  }
  result.id = spec.table === 'poll_votes' ? row.member_id : row.id;
  return result as WithId<T>;
}

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
  if (!isSupabaseConfigured || !supabase) return localWatch<T>(path, callback);

  let spec: TableSpec;
  try {
    spec = parsePath(path);
  } catch (error) {
    console.error(error);
    return () => undefined;
  }

  const client = supabase;
  const order = camelToSnake[orderField] || orderField;
  let active = true;

  const load = async () => {
    let query = client.from(spec.table).select('*');
    for (const [column, value] of Object.entries(spec.filters)) {
      query = query.eq(column, value);
    }
    const { data, error } = await query.order(order, { ascending: true });
    if (!active) return;
    if (error) {
      console.error(`Falha ao carregar ${path}`, error);
      return;
    }
    callback((data || []).map((row) => fromRow<T>(row as Record<string, unknown>, spec)));
  };

  void load();

  const channel = client
    .channel(`tdv:${path}:${newId()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: spec.table,
        ...(spec.realtimeFilter ? { filter: spec.realtimeFilter } : {})
      },
      () => {
        void load();
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn(`Realtime indisponível para ${path}; usando carga inicial.`);
      }
    });

  return () => {
    active = false;
    void client.removeChannel(channel);
  };
}

export async function addDocument<T extends object>(path: string, data: T): Promise<string> {
  const spec = parsePath(path);
  if (!isSupabaseConfigured || !supabase) {
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

  const client = supabase;
  const row = toRow(data);
  delete row.id;
  delete row.created_at;
  const { data: inserted, error } = await client
    .from(spec.table)
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return String((inserted as { id: string }).id);
}

export async function setDocument<T extends object>(
  path: string,
  id: string,
  data: T,
  merge = true
): Promise<void> {
  const spec = parsePath(path);
  if (!isSupabaseConfigured || !supabase) {
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

  const row = toRow(data);
  if (spec.table === 'poll_votes') {
    const { error } = await supabase.from('poll_votes').upsert(
      { ...row, poll_id: spec.pollId, member_id: id },
      { onConflict: 'poll_id,member_id' }
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from(spec.table).upsert({ ...row, id }, { onConflict: 'id' });
  if (error) throw error;
}

export async function updateDocument<T extends object>(
  path: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  const spec = parsePath(path);
  if (!isSupabaseConfigured || !supabase) {
    const rows = readLocal<WithId<T>>(path);
    const index = rows.findIndex((row) => row.id === id);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...data, id };
      writeLocal(path, rows);
    }
    return;
  }
  const { error } = await supabase.from(spec.table).update(toRow(data)).eq('id', id);
  if (error) throw error;
}

export async function removeDocument(path: string, id: string): Promise<void> {
  const spec = parsePath(path);
  if (!isSupabaseConfigured || !supabase) {
    const rows = readLocal<{ id: string }>(path).filter((row) => row.id !== id);
    writeLocal(path, rows);
    return;
  }
  const { error } = await supabase.from(spec.table).delete().eq('id', id);
  if (error) throw error;
}

export async function getMember(uid: string): Promise<Member | null> {
  if (!isSupabaseConfigured || !supabase) {
    return readLocal<Member>(paths.members).find((member) => member.id === uid) ?? null;
  }
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as Member['role'],
    voicePart: row.voice_part as Member['voicePart'],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function saveMember(uid: string, data: Partial<Member>): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    await setDocument<Partial<Member>>(paths.members, uid, data, true);
    return;
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof data.name === 'string') patch.name = data.name;
  if (data.voicePart) patch.voice_part = data.voicePart;
  const { error } = await supabase.from('members').update(patch).eq('id', uid);
  if (error) throw error;
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
    composer: 'CORAL PIBENS ACADEMY',
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
      title: 'Bem-vindo ao CORAL PIBENS ACADEMY',
      body: 'Este é o modo demonstração. Explore o mixer, o looping A-B, o afinador e o chat. Quando o Supabase estiver configurado, os dados passam a ser compartilhados com o coral.',
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
