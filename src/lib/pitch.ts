export interface PitchReading {
  frequency: number;
  midi: number;
  note: string;
  octave: number;
  cents: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function frequencyToPitch(frequency: number): PitchReading | null {
  if (!Number.isFinite(frequency) || frequency < 40 || frequency > 4000) return null;
  const midiFloat = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(midiFloat);
  const noteIndex = ((midi % 12) + 12) % 12;
  return {
    frequency,
    midi,
    note: NOTE_NAMES[noteIndex],
    octave: Math.floor(midi / 12) - 1,
    cents: (midiFloat - midi) * 100
  };
}

export function noteLabel(reading: PitchReading | null): string {
  if (!reading) return '--';
  return `${reading.note}${reading.octave}`;
}

export function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const size = buffer.length;
  let energy = 0;
  for (let i = 0; i < size; i += 1) energy += buffer[i] * buffer[i];
  const rms = Math.sqrt(energy / size);
  if (rms < 0.01) return -1;

  let start = 0;
  let end = size - 1;
  const threshold = 0.2;
  for (let i = 0; i < size / 2; i += 1) {
    if (Math.abs(buffer[i]) < threshold) {
      start = i;
      break;
    }
  }
  for (let i = 1; i < size / 2; i += 1) {
    if (Math.abs(buffer[size - i]) < threshold) {
      end = size - i;
      break;
    }
  }
  const trimmed = buffer.slice(start, end);
  if (trimmed.length < 32) return -1;

  const correlations = new Float32Array(trimmed.length);
  for (let lag = 0; lag < trimmed.length; lag += 1) {
    let sum = 0;
    for (let i = 0; i < trimmed.length - lag; i += 1) {
      sum += trimmed[i] * trimmed[i + lag];
    }
    correlations[lag] = sum;
  }

  let dip = 0;
  while (dip < correlations.length - 1 && correlations[dip] > correlations[dip + 1]) {
    dip += 1;
  }

  let maxValue = -1;
  let maxPosition = -1;
  for (let i = dip; i < correlations.length; i += 1) {
    if (correlations[i] > maxValue) {
      maxValue = correlations[i];
      maxPosition = i;
    }
  }
  if (maxPosition <= 0 || maxPosition >= correlations.length - 1) return -1;

  const previous = correlations[maxPosition - 1];
  const current = correlations[maxPosition];
  const next = correlations[maxPosition + 1];
  const a = (previous + next - 2 * current) / 2;
  const b = (next - previous) / 2;
  const shift = a !== 0 ? -b / (2 * a) : 0;
  const period = maxPosition + shift;
  if (period <= 0) return -1;
  return sampleRate / period;
}

export function createPitchDetector(sampleRate: number) {
  const buffer = new Float32Array(2048);
  return {
    buffer,
    read(analyser: AnalyserNode): PitchReading | null {
      analyser.getFloatTimeDomainData(buffer);
      const frequency = autoCorrelate(buffer, sampleRate);
      if (frequency <= 0) return null;
      return frequencyToPitch(frequency);
    }
  };
}
