import { describe, expect, it } from 'vitest';
import { parseLrc } from '../src/lrc';

describe('parseLrc', () => {
  it('時刻タグを秒にして並べる', () => {
    const lines = parseLrc('[ar:test]\n[00:05.50]あさの そら\n[01:02.00]\n[00:10.25]ひるの うみ');
    expect(lines).toEqual([
      { time: 5.5, text: 'あさの そら' },
      { time: 10.25, text: 'ひるの うみ' },
      { time: 62, text: '' },
    ]);
  });

  it('1行に複数の時刻があれば行を複製する', () => {
    expect(parseLrc('[00:01.00][00:03.00]くりかえし').map((l) => l.time)).toEqual([1, 3]);
  });

  it('単語ごとの時刻タグを取り除く', () => {
    expect(parseLrc('[00:01.00]<00:01.00>あお <00:01.50>そら')[0].text).toBe('あお そら');
  });
});
