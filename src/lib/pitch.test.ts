import { describe, expect, it } from 'vitest';
import { autoCorrelate, frequencyToPitch, noteLabel } from './pitch';

describe('frequencyToPitch', () => {
  it('converte 440 Hz em A4', () => {
    const reading = frequencyToPitch(440);
    expect(reading).not.toBeNull();
    expect(reading?.note).toBe('A');
    expect(reading?.octave).toBe(4);
    expect(reading?.cents).toBeCloseTo(0, 5);
  });

  it('converte 261.63 Hz em C4', () => {
    const reading = frequencyToPitch(261.63);
    expect(reading?.note).toBe('C');
    expect(reading?.octave).toBe(4);
    expect(noteLabel(reading)).toBe('C4');
  });

  it('rejeita frequências fora da faixa', () => {
    expect(frequencyToPitch(10)).toBeNull();
    expect(frequencyToPitch(Number.NaN)).toBeNull();
  });
});

describe('autoCorrelate', () => {
  it('detecta uma senoide de 220 Hz', () => {
    const sampleRate = 44100;
    const buffer = new Float32Array(2048);
    for (let index = 0; index < buffer.length; index += 1) {
      buffer[index] = 0.5 * Math.sin((2 * Math.PI * 220 * index) / sampleRate);
    }
    const frequency = autoCorrelate(buffer, sampleRate);
    expect(frequency).toBeGreaterThan(210);
    expect(frequency).toBeLessThan(230);
  });

  it('retorna -1 para silêncio', () => {
    expect(autoCorrelate(new Float32Array(1024), 44100)).toBe(-1);
  });
});
