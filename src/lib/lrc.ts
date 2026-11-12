export interface LyricLine {
  time: number;
  text: string;
}

const TIME_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(input: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const tags = [...rawLine.matchAll(TIME_TAG)];
    if (tags.length === 0) continue;
    const text = rawLine.replace(/\[[^\]]*\]/g, '').trim();
    for (const tag of tags) {
      const minutes = Number(tag[1]);
      const seconds = Number(tag[2]);
      const fractionRaw = tag[3] ? tag[3].padEnd(3, '0').slice(0, 3) : '000';
      const fraction = Number(fractionRaw) / 1000;
      lines.push({
        time: minutes * 60 + seconds + fraction,
        text
      });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function activeLyricIndex(lines: LyricLine[], time: number): number {
  if (lines.length === 0) return -1;
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].time <= time) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

export function toLrc(lines: LyricLine[]): string {
  return lines
    .map((line) => {
      const minutes = Math.floor(line.time / 60)
        .toString()
        .padStart(2, '0');
      const seconds = Math.floor(line.time % 60)
        .toString()
        .padStart(2, '0');
      const centis = Math.round((line.time % 1) * 100)
        .toString()
        .padStart(2, '0');
      return `[${minutes}:${seconds}.${centis}]${line.text}`;
    })
    .join('\n');
}
