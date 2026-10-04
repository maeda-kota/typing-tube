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

  it('Enter で飛ぶ先は、入力中でなければ次に打つ行の 1 秒前', () => {
    const g = new Game(chart);
    expect(g.skipTarget(0)).toBeNull(); // 最初の行の 1 秒前は 0 秒で、今より先ではない

    g.update(1.5);
    expect(g.skipTarget(1.5)).toBeNull(); // 入力中は飛べない
    g.key('a', 1.6);
    g.key('o', 1.7);
    expect(g.skipTarget(1.7)).toBe(6); // 次に打つ行 (7 秒開始) の 1 秒前。間奏行は飛ばす

    g.update(7.5);
    g.key('k', 7.6);
    g.key('a', 7.7);
    g.key('k', 7.8);
    g.key('i', 7.9);
    expect(g.skipTarget(7.9)).toBe(11); // 次がなければ曲の終わり
  });

  it('途中の行を飛ばしても時間切れとして数える', () => {
    const g = new Game(chart);
    g.update(12);
    const r = g.result();
    expect(r.typingSeconds).toBe(4 + 4);
    expect(r.leftKeys).toBe(2 + 4); // ao と kaki
  });
});
