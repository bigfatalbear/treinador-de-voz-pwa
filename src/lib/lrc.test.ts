import { describe, expect, it } from 'vitest';
import { activeLyricIndex, parseLrc, toLrc } from './lrc';

describe('parseLrc', () => {
  it('interpreta minutos, segundos e centésimos', () => {
    const lines = parseLrc('[00:00.00]Primeira\n[01:02.50]Segunda\n[00:10]Terceira');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ time: 0, text: 'Primeira' });
    expect(lines[1]).toEqual({ time: 10, text: 'Terceira' });
    expect(lines[2]).toEqual({ time: 62.5, text: 'Segunda' });
  });

  it('ordena linhas e aceita múltiplas marcações na mesma linha', () => {
    const lines = parseLrc('[00:20.00]Refrão\n[00:05.00][00:30.00]Verso');
    expect(lines.map((line) => line.time)).toEqual([5, 20, 30]);
    expect(lines[0].text).toBe('Verso');
    expect(lines[2].text).toBe('Verso');
  });

  it('ignora linhas sem marcação de tempo', () => {
    expect(parseLrc('sem tempo\n[00:01.00]com tempo')).toHaveLength(1);
  });

  it('gera LRC a partir das linhas', () => {
    expect(toLrc([{ time: 62.5, text: 'Linha' }])).toBe('[01:02.50]Linha');
  });
});

describe('activeLyricIndex', () => {
  const lines = [
    { time: 0, text: 'A' },
    { time: 5, text: 'B' },
    { time: 10, text: 'C' }
  ];

  it('encontra a linha ativa', () => {
    expect(activeLyricIndex(lines, 0)).toBe(0);
    expect(activeLyricIndex(lines, 4.9)).toBe(0);
    expect(activeLyricIndex(lines, 5)).toBe(1);
    expect(activeLyricIndex(lines, 12)).toBe(2);
  });

  it('retorna -1 antes da primeira linha', () => {
    expect(activeLyricIndex([{ time: 5, text: 'B' }], 1)).toBe(-1);
    expect(activeLyricIndex([], 1)).toBe(-1);
  });
});
