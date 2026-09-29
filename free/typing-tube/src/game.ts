// プレイ中の進行と集計。画面には依存しない。
import { RomajiMatcher } from './romaji';
import type { Chart } from './types';

// 最後の行の後ろに間奏行がないときに、最後の行へ与える時間(秒)。
const LAST_LINE_SECONDS = 8;

export interface GameLine {
  start: number;
  end: number;
  lyric: string;
  kana: string;
  matcher: RomajiMatcher | null; // 間奏行は null
}

export interface Result {
  keys: number; // 正しく打った数
  misses: number;
  typingSeconds: number;
  keysPerSecond: number;
  accuracy: number; // 0〜100
  leftKeys: number; // 打ち残した打鍵数の目安
  clearedLines: number;
  totalLines: number;
}

export class Game {
  readonly lines: GameLine[];
  readonly endTime: number;
  current = -1; // 今の行。最初の行の前は -1
  keys = 0;
  misses = 0;
  private typingSeconds = 0;
  private leftKeys = 0;
  private clearedLines = 0;
  private lineClosed = true;

  constructor(chart: Chart) {
    const sorted = [...chart.lines].sort((a, b) => a.time - b.time);
    this.lines = sorted.map((l, i) => {
      const start = l.time + chart.offset;
      const next = sorted[i + 1];
      const m = l.kana.trim() ? new RomajiMatcher(l.kana) : null;
      const matcher = m && m.units.length ? m : null;
      // 最後の行が間奏行なら、その行の開始で曲を終える
      const end = next ? next.time + chart.offset : start + (matcher ? LAST_LINE_SECONDS : 0);
      return { start, end, lyric: l.lyric, kana: l.kana, matcher };
    });
    this.endTime = this.lines.length ? this.lines[this.lines.length - 1].end : 0;
  }

  get line(): GameLine | null {
    return this.lines[this.current] ?? null;
  }

  get nextLine(): GameLine | null {
    for (let i = this.current + 1; i < this.lines.length; i++) if (this.lines[i].matcher) return this.lines[i];
    return null;
  }

  // 再生時刻 t に合わせて今の行を進める。曲が終わったら true を返す。
  update(t: number): boolean {
    while (this.current + 1 < this.lines.length && this.lines[this.current + 1].start <= t) {
      this.closeLine(this.lines[this.current + 1].start);
      this.current++;
      this.lineClosed = !this.line?.matcher;
    }
    if (t >= this.endTime) {
      this.closeLine(this.endTime);
      return true;
    }
    return false;
  }

  // 今の行の入力を締め、時間と打ち残しを集計に加える。
  private closeLine(at: number): void {
    const line = this.line;
    if (this.lineClosed || !line?.matcher) return;
    this.lineClosed = true;
    this.typingSeconds += Math.max(0, Math.min(at, line.end) - line.start);
    this.leftKeys += line.matcher.remainingKeys();
  }

  // キー入力を受け取る。今の行が入力中でなければ何もしない。
  key(k: string, t: number): 'ok' | 'miss' | 'done' | 'ignored' {
    const line = this.line;
    if (this.lineClosed || !line?.matcher) return 'ignored';
    const r = line.matcher.input(k);
    if (r === 'miss') this.misses++;
    else this.keys++;
    if (r === 'done') {
      this.clearedLines++;
      this.closeLine(t);
    }
    return r;
  }

  get lineActive(): boolean {
    return !this.lineClosed;
  }

  result(): Result {
    const total = this.keys + this.misses;
    return {
      keys: this.keys,
      misses: this.misses,
      typingSeconds: this.typingSeconds,
      keysPerSecond: this.typingSeconds > 0 ? this.keys / this.typingSeconds : 0,
      accuracy: total > 0 ? (this.keys / total) * 100 : 0,
      leftKeys: this.leftKeys,
      clearedLines: this.clearedLines,
      totalLines: this.lines.filter((l) => l.matcher).length,
    };
  }
}
