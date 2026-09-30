import { describe, expect, it } from 'vitest';
import { applyRules, mergeShortLines, removeParens, shiftLines } from '../src/transform';

const line = (time: number, lyric: string, kana = lyric) => ({ time, lyric, kana });

describe('removeParens', () => {
  it('半角と全角のカッコを中身ごと消す', () => {
    expect(removeParens('あお (そら) うみ（やま）')).toBe('あお うみ');
    expect(removeParens('(あ(い)う)え')).toBe('え');
  });
});

describe('shiftLines', () => {
  it('全行の時刻をずらし、0 未満にはしない', () => {
    expect(shiftLines([line(0.1, 'a'), line(5, 'b')], -0.3).map((l) => l.time)).toEqual([0, 4.7]);
  });
});

describe('mergeShortLines', () => {
  it('4 秒未満の行を後ろの行と結合し、4 秒以上になるまで続ける', () => {
    const out = mergeShortLines([line(0, 'あ'), line(1, 'い'), line(2.5, 'う'), line(5, 'え'), line(10, '')], 4);
    expect(out).toEqual([line(0, 'あ い う'), line(5, 'え'), line(10, '')]);
  });

  it('後ろが間奏行なら前の行と結合する', () => {
    const out = mergeShortLines([line(0, 'あ'), line(5, 'い'), line(7, ''), line(20, 'う'), line(30, '')], 4);
    expect(out).toEqual([line(0, 'あ い'), line(7, ''), line(20, 'う'), line(30, '')]);
  });
});

describe('applyRules', () => {
  it('カッコ削除、時刻ずらし、結合の順に適用する', () => {
    const out = applyRules([line(1, 'あ (x)'), line(2, '(y)'), line(3, 'い'), line(4, 'う'), line(9, '')], {
      removeParens: true,
      shift: -0.3,
      minSeconds: 4,
    });
    expect(out).toEqual([line(0.7, 'あ'), line(1.7, ''), line(2.7, 'い う'), line(8.7, '')]);
  });
});
