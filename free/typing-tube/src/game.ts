// プレイ中の進行と集計。画面には依存しない。
import { RomajiMatcher } from './romaji';
import type { Chart } from './types';

// 最後の行の後ろに間奏行がないときに、最後の行へ与える時間(秒)。
const LAST_LINE_SECONDS = 8;

// Enter / Backspace で飛ぶとき、行の開始より何秒前に着地するか。動画の読み込み待ちで出だしを逃さないため。
const SKIP_LEAD_SECONDS = 1;

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

// 行ごとの成績。Backspace で戻った行は消して打ち直せるよう、行単位で持つ。
interface LineStats {
  keys: number;
  misses: number;
  seconds: number;
  left: number;
  cleared: boolean;
}

const emptyStats = (): LineStats => ({ keys: 0, misses: 0, seconds: 0, left: 0, cleared: false });

export class Game {
  readonly lines: GameLine[];
  readonly endTime: number;
  current = -1; // 今の行。最初の行の前は -1
  private stats: LineStats[];
  private lineClosed = true;

  constructor(chart: Chart) {
    const sorted = [...chart.lines].sort((a, b) => a.time - b.time);
    this.lines = sorted.map((l, i) => {
      const start = l.time + chart.offset;
      const next = sorted[i + 1];
      // 最後の行が間奏行なら、その行の開始で曲を終える
      const matcher = Game.makeMatcher(l.kana);
      const end = next ? next.time + chart.offset : start + (matcher ? LAST_LINE_SECONDS : 0);
      return { start, end, lyric: l.lyric, kana: l.kana, matcher };
    });
    this.stats = this.lines.map(emptyStats);
    this.endTime = this.lines.length ? this.lines[this.lines.length - 1].end : 0;
  }

  private static makeMatcher(kana: string): RomajiMatcher | null {
    const m = kana.trim() ? new RomajiMatcher(kana) : null;
    return m && m.units.length ? m : null;
  }

  private sum(key: 'keys' | 'misses' | 'seconds' | 'left'): number {
    return this.stats.reduce((s, x) => s + x[key], 0);
  }

  get keys(): number {
    return this.sum('keys');
  }

  get misses(): number {
    return this.sum('misses');
  }

  get line(): GameLine | null {
    return this.lines[this.current] ?? null;
  }

  private nextIndex(): number {
    for (let i = this.current + 1; i < this.lines.length; i++) if (this.lines[i].matcher) return i;
    return -1;
  }

  get nextLine(): GameLine | null {
    return this.lines[this.nextIndex()] ?? null;
  }

  // Enter で飛ぶ先の時刻。入力中の行があるときは null。
  // 次に打つ行の開始の lead 秒前に飛ぶ(今より前には戻さない)。次がなければ曲の終わりに飛ぶ。
  skipTarget(t: number, lead = SKIP_LEAD_SECONDS): number | null {
    if (this.lineActive) return null;
    const next = this.nextLine;
    if (!next) return this.endTime;
    const target = Math.max(t, next.start - lead);
    return target > t ? target : null;
  }

  // Backspace で戻る先の時刻。Enter の逆で、次に打つ行の1つ前の打つ行の開始 lead 秒前に戻る。
  // 打ち終えた行のあとなら、その行をやり直す位置になる。入力中の行があるとき、戻る行がないときは null。
  backTarget(lead = SKIP_LEAD_SECONDS): number | null {
    if (this.lineActive) return null;
    const next = this.nextIndex();
    const before = next < 0 ? this.lines.length : next;
    for (let i = before - 1; i >= 0; i--) {
      if (this.lines[i].matcher) return Math.max(0, this.lines[i].start - lead);
    }
    return null;
  }

  // 時刻 t まで戻す。t より後に始まる行は、成績を消して最初から打てる状態にする。
  rewind(t: number): void {
    let idx = -1;
    for (let i = 0; i < this.lines.length; i++) if (this.lines[i].start <= t) idx = i;
    for (let i = idx + 1; i < this.lines.length; i++) {
      this.stats[i] = emptyStats();
      this.lines[i].matcher = Game.makeMatcher(this.lines[i].kana);
    }
    this.current = idx;
    // 戻った先の行はすでに締めた行なので、入力は受け付けない
    this.lineClosed = true;
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

  // 今の行の入力を締め、時間と打ち残しを記録する。
  private closeLine(at: number): void {
    const line = this.line;
    if (this.lineClosed || !line?.matcher) return;
    this.lineClosed = true;
    const s = this.stats[this.current];
    s.seconds = Math.max(0, Math.min(at, line.end) - line.start);
    s.left = line.matcher.remainingKeys();
  }

  // キー入力を受け取る。今の行が入力中でなければ何もしない。
  key(k: string, t: number): 'ok' | 'miss' | 'done' | 'ignored' {
    const line = this.line;
    if (this.lineClosed || !line?.matcher) return 'ignored';
    const s = this.stats[this.current];
    const r = line.matcher.input(k);
    if (r === 'miss') s.misses++;
    else s.keys++;
    if (r === 'done') {
      s.cleared = true;
      this.closeLine(t);
    }
    return r;
  }

  get lineActive(): boolean {
    return !this.lineClosed;
  }

  result(): Result {
    const keys = this.keys;
    const total = keys + this.misses;
    const typingSeconds = this.sum('seconds');
    return {
      keys,
      misses: this.misses,
      typingSeconds,
      keysPerSecond: typingSeconds > 0 ? keys / typingSeconds : 0,
      accuracy: total > 0 ? (keys / total) * 100 : 0,
      leftKeys: this.sum('left'),
      clearedLines: this.stats.filter((s) => s.cleared).length,
      totalLines: this.lines.filter((l) => l.matcher).length,
    };
  }
}
