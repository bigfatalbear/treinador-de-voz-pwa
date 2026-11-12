export type VoicePart = 'soprano' | 'contralto' | 'tenor' | 'baixo';
export type Role = 'regente' | 'coralista';
export type Room = 'geral' | VoicePart;
export type VoteValue = 'sim' | 'nao' | 'talvez';

export const VOICE_PARTS: VoicePart[] = ['soprano', 'contralto', 'tenor', 'baixo'];
export const ROOMS: Room[] = ['geral', 'soprano', 'contralto', 'tenor', 'baixo'];
export const VOTE_VALUES: VoteValue[] = ['sim', 'nao', 'talvez'];

export const VOICE_PART_LABEL: Record<VoicePart, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo'
};

export const ROOM_LABEL: Record<Room, string> = {
  geral: 'Geral',
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo'
};

export const VOTE_LABEL: Record<VoteValue, string> = {
  sim: 'Confirmo',
  nao: 'Não posso',
  talvez: 'Talvez'
};

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  voicePart: VoicePart;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Track {
  id: string;
  title: string;
  composer?: string;
  bpm: number;
  lyrics?: string;
  demo?: boolean;
  parts: Partial<Record<VoicePart, string>>;
  createdAt?: unknown;
}

export interface Score {
  id: string;
  title: string;
  pdfPath: string;
  createdAt?: unknown;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  authorName: string;
  pinned: boolean;
  createdAt?: unknown;
}

export interface Poll {
  id: string;
  title: string;
  eventDate: string;
  authorName: string;
  createdAt?: unknown;
}

export interface Vote {
  id: string;
  value: VoteValue;
  name: string;
  updatedAt?: unknown;
}

export interface Message {
  id: string;
  room: Room;
  text?: string;
  audioPath?: string;
  audioDuration?: number;
  authorId: string;
  authorName: string;
  createdAt?: unknown;
}

export interface Warmup {
  id: string;
  title: string;
  description: string;
  audioPath: string;
  category: string;
  createdAt?: unknown;
}

export interface TrainingVideo {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  category: string;
  voicePart?: VoicePart | null;
  createdAt?: unknown;
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
}
