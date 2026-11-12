import * as Tone from 'tone';
import { LIMITS } from './branding';
import { getCachedPart } from './cache';
import { resolveMediaUrl } from './media';
import { VOICE_PARTS, type Track, type VoicePart } from '../types';
import { clamp } from './utils';

const DEMO_SECONDS = 8;
const DEMO_CHORD_SECONDS = 2;

const DEMO_NOTES: Record<VoicePart, number[][]> = {
  soprano: [
    [523.25, 659.25, 783.99],
    [440, 523.25, 659.25],
    [349.23, 440, 523.25],
    [392, 493.88, 587.33]
  ],
  contralto: [
    [392, 493.88, 587.33],
    [329.63, 392, 493.88],
    [261.63, 349.23, 440],
    [293.66, 392, 493.88]
  ],
  tenor: [
    [261.63, 329.63, 392],
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [196, 246.94, 293.66]
  ],
  baixo: [
    [130.81, 164.81, 196],
    [110, 130.81, 164.81],
    [87.31, 110, 130.81],
    [98, 123.47, 146.83]
  ]
};

type PlayerMap = Partial<Record<VoicePart, Tone.GrainPlayer>>;
type GainMap = Partial<Record<VoicePart, Tone.Gain>>;

export interface LoopRange {
  enabled: boolean;
  a: number;
  b: number;
}

function buildDemoBuffer(part: VoicePart): Tone.ToneAudioBuffer {
  const context = Tone.getContext().rawContext as AudioContext;
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * DEMO_SECONDS);
  const audioBuffer = context.createBuffer(1, length, sampleRate);
  const data = audioBuffer.getChannelData(0);
  const chords = DEMO_NOTES[part];

  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const chordIndex = Math.min(chords.length - 1, Math.floor(time / DEMO_CHORD_SECONDS));
    const local = time - chordIndex * DEMO_CHORD_SECONDS;
    const attack = Math.min(1, local / 0.06);
    const release = Math.min(1, (DEMO_CHORD_SECONDS - local) / 0.14);
    const envelope = Math.max(0, Math.min(attack, release));
    let sample = 0;
    for (const frequency of chords[chordIndex]) {
      const vibrato = 0.55 * Math.sin(2 * Math.PI * 5 * time);
      const phase = 2 * Math.PI * frequency * time + vibrato;
      sample += Math.sin(phase) * 0.16;
      sample += Math.sin(phase * 2) * 0.05;
      sample += Math.sin(phase * 3) * 0.024;
    }
    data[index] = sample * envelope * 0.72;
  }

  return new Tone.ToneAudioBuffer(audioBuffer);
}

export class ChoirPlayer {
  private players: PlayerMap = {};
  private gains: GainMap = {};
  private master = new Tone.Gain(0.9).toDestination();
  private rate = 1;
  private baseBpm: number = LIMITS.baseBpm;
  private seek = 0;
  private startedAt = 0;
  private playing = false;
  private duration = 0;
  private demo = false;
  private loop: LoopRange = { enabled: false, a: 0, b: 0 };
  private volumes: Record<VoicePart, number> = {
    soprano: 0.8,
    contralto: 0.8,
    tenor: 0.8,
    baixo: 0.8
  };
  private currentTrack: Track | null = null;

  get availableParts(): VoicePart[] {
    return VOICE_PARTS.filter((part) => Boolean(this.players[part]));
  }

  getTrackDuration(): number {
    return this.duration;
  }

  getLoop(): LoopRange {
    return { ...this.loop };
  }

  getVolume(part: VoicePart): number {
    return this.volumes[part];
  }

  async load(track: Track): Promise<number> {
    this.stop();
    this.disposePlayers();
    this.currentTrack = track;
    this.demo = Boolean(track.demo);
    this.baseBpm = track.bpm > 0 ? track.bpm : LIMITS.baseBpm;
    this.rate = 1;
    this.duration = 0;
    this.seek = 0;
    this.loop = { enabled: false, a: 0, b: 0 };

    const parts = VOICE_PARTS.filter((part) => this.demo || track.parts[part]);
    if (parts.length === 0) throw new Error('Esta faixa não tem arquivos de naipe.');

    try {
      for (const part of parts) {
        let buffer: Tone.ToneAudioBuffer;
        if (this.demo) {
          buffer = buildDemoBuffer(part);
        } else {
          const cached = await getCachedPart(track.id, part);
          if (cached) {
            const objectUrl = URL.createObjectURL(cached);
            try {
              buffer = await Tone.ToneAudioBuffer.fromUrl(objectUrl);
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
          } else {
            const storagePath = track.parts[part];
            if (!storagePath) continue;
            const url = await resolveMediaUrl(storagePath);
            buffer = await Tone.ToneAudioBuffer.fromUrl(url);
          }
          this.duration = Math.max(this.duration, buffer.duration);
        }
        const gain = new Tone.Gain(this.volumes[part]).connect(this.master);
        const player = new Tone.GrainPlayer({
          url: buffer,
          loop: false,
          grainSize: 0.15,
          overlap: 0.06,
          playbackRate: this.rate
        }).connect(gain);
        this.players[part] = player;
        this.gains[part] = gain;
      }
    } catch (error) {
      this.disposePlayers();
      throw error;
    }

    if (this.demo) this.duration = DEMO_SECONDS;
    if (this.duration <= 0) throw new Error('Não foi possível carregar o áudio.');
    return this.duration;
  }

  async play(): Promise<void> {
    if (this.playing) return;
    await Tone.start();
    if (this.seek >= this.duration - 0.03) this.seek = 0;
    this.startAt(this.seek);
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.seek = this.getPosition();
    this.stopPlayers();
    this.playing = false;
  }

  stop(): void {
    this.stopPlayers();
    this.playing = false;
    this.seek = 0;
  }

  seekTo(seconds: number): void {
    const position = clamp(seconds, 0, Math.max(0, this.duration - 0.02));
    if (this.playing) {
      this.seek = position;
      this.startAt(position);
    } else {
      this.seek = position;
    }
  }

  setBpm(bpm: number): void {
    const position = this.getPosition();
    this.rate = clamp(bpm, LIMITS.bpmMin, LIMITS.bpmMax) / this.baseBpm;
    for (const player of Object.values(this.players)) {
      if (player) player.playbackRate = this.rate;
    }
    if (this.playing) {
      this.seek = position;
      this.startAt(position);
    }
  }

  setLoop(a: number, b: number, enabled: boolean): void {
    const start = clamp(a, 0, Math.max(0, this.duration - 0.1));
    const end = clamp(b, start + 0.1, this.duration);
    this.loop = { a: start, b: end, enabled };
    if (enabled && (this.getPosition() < start || this.getPosition() > end)) {
      this.seekTo(start);
    }
  }

  setVolume(part: VoicePart, value: number): void {
    const normalized = clamp(value, 0, 1);
    this.volumes[part] = normalized;
    this.gains[part]?.gain.rampTo(normalized, 0.05);
  }

  setMaster(value: number): void {
    this.master.gain.rampTo(clamp(value, 0, 1), 0.05);
  }

  getPosition(): number {
    if (this.duration <= 0) return 0;
    const raw = this.rawPosition();
    if (this.loop.enabled && this.loop.b > this.loop.a && raw >= this.loop.b) {
      const span = this.loop.b - this.loop.a;
      return this.loop.a + ((raw - this.loop.a) % span);
    }
    return clamp(raw, 0, this.duration);
  }

  tick(): void {
    if (!this.playing) return;
    const raw = this.rawPosition();
    if (this.loop.enabled && this.loop.b > this.loop.a && raw >= this.loop.b) {
      this.seek = this.loop.a;
      this.startAt(this.loop.a);
      return;
    }
    if (raw >= this.duration) {
      this.stopPlayers();
      this.playing = false;
      this.seek = this.duration;
    }
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get track(): Track | null {
    return this.currentTrack;
  }

  dispose(): void {
    this.stop();
    this.disposePlayers();
    this.master.dispose();
  }

  private rawPosition(): number {
    if (!this.playing) return this.seek;
    return this.seek + (Tone.now() - this.startedAt) * this.rate;
  }

  private startAt(offset: number): void {
    this.stopPlayers();
    this.seek = offset;
    this.startedAt = Tone.now() + 0.06;
    for (const player of Object.values(this.players)) {
      if (!player) continue;
      try {
        player.start(this.startedAt, offset);
      } catch (error) {
        console.warn('Falha ao iniciar stem.', error);
      }
    }
  }

  private stopPlayers(): void {
    for (const player of Object.values(this.players)) {
      if (!player) continue;
      try {
        player.stop();
      } catch {
        // Player ainda não iniciado.
      }
    }
  }

  private disposePlayers(): void {
    for (const player of Object.values(this.players)) player?.dispose();
    for (const gain of Object.values(this.gains)) gain?.dispose();
    this.players = {};
    this.gains = {};
  }
}
