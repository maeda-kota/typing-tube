// 譜面の行をまとめて整える処理。曲リストの取り込み設定や、作成画面のボタンから使う。
import type { ChartLine } from './types';

export interface ImportRules {
  removeParens?: boolean; // ( ) と （ ） で囲まれた部分を消す
  shift?: number; // 秒。全行の開始時刻に足す
  minSeconds?: number; // 入力する行が最低この秒数になるよう、隣の行と結合する
}

const PARENS = /[(（][^()（）]*[)）]/g;

export function removeParens(text: string): string {
  let prev = '';
  let s = text;
  // 入れ子のカッコにも対応するため、変化がなくなるまで繰り返す
  while (s !== prev) {
    prev = s;
    s = s.replace(PARENS, '');
  }
  return s.replace(/\s+/g, ' ').trim();
}

export function removeParensFromLines(lines: ChartLine[]): ChartLine[] {
  return lines.map((l) => ({ ...l, lyric: removeParens(l.lyric), kana: removeParens(l.kana) }));
}

export function shiftLines(lines: ChartLine[], seconds: number): ChartLine[] {
  return lines.map((l) => ({ ...l, time: Math.max(0, Math.round((l.time + seconds) * 100) / 100) }));
}

const isTyping = (l: ChartLine) => l.lyric.trim() !== '' || l.kana.trim() !== '';

function join(a: string, b: string): string {
  return [a.trim(), b.trim()].filter(Boolean).join(' ');
}

// 入力する行の長さ(次の行の開始まで)が minSeconds 未満なら、隣の入力する行と結合する。
// まず後ろの行と結合し、後ろが間奏行や曲の終わりなら前の行と結合する。
export function mergeShortLines(lines: ChartLine[], minSeconds: number): ChartLine[] {
  const out = [...lines].sort((a, b) => a.time - b.time).map((l) => ({ ...l }));
  const duration = (i: number) => (i + 1 < out.length ? out[i + 1].time - out[i].time : Number.POSITIVE_INFINITY);
  let i = 0;
  while (i < out.length) {
    const cur = out[i];
    if (!isTyping(cur) || duration(i) >= minSeconds) {
      i++;
      continue;
    }
    const next = out[i + 1];
    if (next && isTyping(next)) {
      out.splice(i, 2, { time: cur.time, lyric: join(cur.lyric, next.lyric), kana: join(cur.kana, next.kana) });
      continue; // 結合した行をもう一度調べる
    }
    const prev = out[i - 1];
    if (prev && isTyping(prev)) {
      out.splice(i - 1, 2, { time: prev.time, lyric: join(prev.lyric, cur.lyric), kana: join(prev.kana, cur.kana) });
      i--;
      continue;
    }
    i++;
  }
  return out;
}

export function applyRules(lines: ChartLine[], rules: ImportRules): ChartLine[] {
  let out = lines;
  if (rules.removeParens) out = removeParensFromLines(out);
  if (rules.shift) out = shiftLines(out, rules.shift);
  if (rules.minSeconds) out = mergeShortLines(out, rules.minSeconds);
  return out;
}
