import { describe, expect, it } from 'vitest';
import { Game } from '../src/game';
import type { Chart } from '../src/types';

const chart: Chart = {
  id: 't',
  title: 'テスト',
  videoId: '',
  offset: 1,
  lines: [
    { time: 0, lyric: 'あお', kana: 'あお' },
    { time: 4, lyric: '', kana: '' },
    { time: 6, lyric: 'かき', kana: 'かき' },
    { time: 10, lyric: '', kana: '' },
  ],
};

describe('Game', () => {
  it('時刻で行を進め、打鍵、ミス、打鍵時間を集計する', () => {
    const g = new Game(chart);
    g.update(0.5);
    expect(g.key('a', 0.5)).toBe('ignored'); // 補正で開始が 1 秒後になっている

    g.update(1);
    expect(g.key('a', 1.5)).toBe('ok');
    expect(g.key('x', 1.6)).toBe('miss');
    expect(g.key('o', 3)).toBe('done'); // 1 秒から 3 秒まで打っていた
    expect(g.key('a', 3.1)).toBe('ignored');

    g.update(7);
    expect(g.lineActive).toBe(true);
    g.key('k', 7.5);
    g.key('a', 8); // 残り ki のまま時間切れ
    expect(g.update(11)).toBe(true);

    const r = g.result();
    expect(r.keys).toBe(4);
    expect(r.misses).toBe(1);
    expect(r.typingSeconds).toBe(2 + 4);
    expect(r.keysPerSecond).toBeCloseTo(4 / 6);
    expect(r.leftKeys).toBe(2);
    expect(r.clearedLines).toBe(1);
    expect(r.totalLines).toBe(2);
  });

  it('途中の行を飛ばしても時間切れとして数える', () => {
    const g = new Game(chart);
    g.update(12);
    const r = g.result();
    expect(r.typingSeconds).toBe(4 + 4);
    expect(r.leftKeys).toBe(2 + 4); // ao と kaki
  });
});
