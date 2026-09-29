import { describe, expect, it } from 'vitest';
import { RomajiMatcher, toUnits } from '../src/romaji';

function typeAll(kana: string, keys: string): { misses: number; done: boolean } {
  const m = new RomajiMatcher(kana);
  let misses = 0;
  for (const k of keys) if (m.input(k) === 'miss') misses++;
  return { misses, done: m.finished };
}

describe('RomajiMatcher', () => {
  it.each([
    ['し', 'si'], ['し', 'shi'], ['し', 'ci'],
    ['つ', 'tu'], ['つ', 'tsu'], ['ふ', 'fu'], ['ふ', 'hu'],
    ['じ', 'ji'], ['じ', 'zi'], ['ち', 'chi'], ['ち', 'ti'],
  ])('%s を %s で打てる', (kana, keys) => {
    expect(typeAll(kana, keys)).toEqual({ misses: 0, done: true });
  });

  it.each([['しゃ', 'sha'], ['しゃ', 'sya'], ['しゃ', 'sixya'], ['きょ', 'kilyo'], ['ちゃ', 'cha']])(
    '拗音 %s を %s で打てる',
    (kana, keys) => expect(typeAll(kana, keys)).toEqual({ misses: 0, done: true }),
  );

  it.each([['きって', 'kitte'], ['きって', 'kixtute'], ['きって', 'kiltsute'], ['まっちゃ', 'maccha'], ['まっちゃ', 'mattya']])(
    '促音 %s を %s で打てる',
    (kana, keys) => expect(typeAll(kana, keys)).toEqual({ misses: 0, done: true }),
  );

  it('子音の前の ん は n 1回で打てる', () => {
    expect(typeAll('かんじ', 'kanji')).toEqual({ misses: 0, done: true });
    expect(typeAll('かんじ', 'kannji')).toEqual({ misses: 0, done: true });
  });

  it('母音や な行の前と行末の ん は nn が必要', () => {
    expect(typeAll('きんえん', 'kinen').done).toBe(false);
    expect(typeAll('きんえん', 'kinnenn')).toEqual({ misses: 0, done: true });
    expect(typeAll('こんにちは', 'konnnitiha')).toEqual({ misses: 0, done: true });
  });

  it('間違ったキーはミスとして数え、状態は進めない', () => {
    expect(typeAll('あお', 'axo')).toEqual({ misses: 1, done: true });
  });

  it('カタカナ、長音、記号、英数字、空白を扱う', () => {
    expect(toUnits('ラ ラー、ABC!').map((u) => u.kana).join('')).toBe('ららー、abc!');
    expect(typeAll('ラ ラー、ABC!', 'rara-,abc!')).toEqual({ misses: 0, done: true });
  });

  it('打ち終えた部分と残りを表示用に返す', () => {
    const m = new RomajiMatcher('しゃしん');
    m.input('s');
    m.input('h');
    expect(m.display()).toEqual({ typed: 'sh', rest: 'asinn' });
  });
});
