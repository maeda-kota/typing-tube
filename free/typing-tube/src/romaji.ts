// ひらがなの文字列を、ローマ字の打ち方の揺れを許しながら照合する入力エンジン。

// 1文字の仮名と、その打ち方の候補。先頭の候補が画面に表示される。
const SINGLE: Record<string, string[]> = {
  あ: ['a'], い: ['i', 'yi'], う: ['u', 'wu', 'whu'], え: ['e'], お: ['o'],
  か: ['ka', 'ca'], き: ['ki'], く: ['ku', 'cu', 'qu'], け: ['ke'], こ: ['ko', 'co'],
  さ: ['sa'], し: ['si', 'shi', 'ci'], す: ['su'], せ: ['se', 'ce'], そ: ['so'],
  た: ['ta'], ち: ['ti', 'chi'], つ: ['tu', 'tsu'], て: ['te'], と: ['to'],
  な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
  は: ['ha'], ひ: ['hi'], ふ: ['hu', 'fu'], へ: ['he'], ほ: ['ho'],
  ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
  や: ['ya'], ゆ: ['yu'], よ: ['yo'],
  ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
  わ: ['wa'], ゐ: ['wi'], ゑ: ['we'], を: ['wo'],
  が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
  ざ: ['za'], じ: ['zi', 'ji'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
  だ: ['da'], ぢ: ['di'], づ: ['du'], で: ['de'], ど: ['do'],
  ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
  ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
  ゔ: ['vu'],
  ぁ: ['xa', 'la'], ぃ: ['xi', 'li'], ぅ: ['xu', 'lu'], ぇ: ['xe', 'le'], ぉ: ['xo', 'lo'],
  ゃ: ['xya', 'lya'], ゅ: ['xyu', 'lyu'], ょ: ['xyo', 'lyo'], ゎ: ['xwa', 'lwa'],
  っ: ['xtu', 'ltu', 'xtsu', 'ltsu'],
  ん: ['nn', 'xn', "n'"],
  ー: ['-'], '、': [','], '。': ['.'], '・': ['/'], '「': ['['], '」': [']'],
  '〜': ['~'], '～': ['~'],
};

// 2文字の仮名(拗音など)をまとめて打つときの候補。
const DOUBLE: Record<string, string[]> = {
  きゃ: ['kya'], きぃ: ['kyi'], きゅ: ['kyu'], きぇ: ['kye'], きょ: ['kyo'],
  しゃ: ['sya', 'sha'], しぃ: ['syi'], しゅ: ['syu', 'shu'], しぇ: ['sye', 'she'], しょ: ['syo', 'sho'],
  ちゃ: ['tya', 'cha', 'cya'], ちぃ: ['tyi', 'cyi'], ちゅ: ['tyu', 'chu', 'cyu'], ちぇ: ['tye', 'che', 'cye'], ちょ: ['tyo', 'cho', 'cyo'],
  にゃ: ['nya'], にぃ: ['nyi'], にゅ: ['nyu'], にぇ: ['nye'], にょ: ['nyo'],
  ひゃ: ['hya'], ひぃ: ['hyi'], ひゅ: ['hyu'], ひぇ: ['hye'], ひょ: ['hyo'],
  みゃ: ['mya'], みぃ: ['myi'], みゅ: ['myu'], みぇ: ['mye'], みょ: ['myo'],
  りゃ: ['rya'], りぃ: ['ryi'], りゅ: ['ryu'], りぇ: ['rye'], りょ: ['ryo'],
  ぎゃ: ['gya'], ぎぃ: ['gyi'], ぎゅ: ['gyu'], ぎぇ: ['gye'], ぎょ: ['gyo'],
  じゃ: ['zya', 'ja', 'jya'], じぃ: ['zyi', 'jyi'], じゅ: ['zyu', 'ju', 'jyu'], じぇ: ['zye', 'je', 'jye'], じょ: ['zyo', 'jo', 'jyo'],
  ぢゃ: ['dya'], ぢぃ: ['dyi'], ぢゅ: ['dyu'], ぢぇ: ['dye'], ぢょ: ['dyo'],
  びゃ: ['bya'], びぃ: ['byi'], びゅ: ['byu'], びぇ: ['bye'], びょ: ['byo'],
  ぴゃ: ['pya'], ぴぃ: ['pyi'], ぴゅ: ['pyu'], ぴぇ: ['pye'], ぴょ: ['pyo'],
  ふぁ: ['fa'], ふぃ: ['fi'], ふぇ: ['fe'], ふぉ: ['fo'], ふゅ: ['fyu'],
  てぃ: ['thi'], でぃ: ['dhi'], てゅ: ['thu'], でゅ: ['dhu'],
  とぅ: ['twu'], どぅ: ['dwu'],
  うぃ: ['wi'], うぇ: ['we'], うぉ: ['who'],
  ゔぁ: ['va'], ゔぃ: ['vi'], ゔぇ: ['ve'], ゔぉ: ['vo'],
  つぁ: ['tsa'], つぃ: ['tsi'], つぇ: ['tse'], つぉ: ['tso'],
  いぇ: ['ye'],
};

const VOWELS_N_Y = new Set(['a', 'i', 'u', 'e', 'o', 'n', 'y']);
const NO_DOUBLE = new Set(['a', 'i', 'u', 'e', 'o', 'n']);

export interface Unit {
  kana: string;
  candidates: string[];
}

function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// 入力対象として使える形にそろえる。カタカナはひらがなに、全角英数字は半角小文字にする。
export function normalizeKana(s: string): string {
  return toHiragana(s.normalize('NFKC').replace(/[ーｰ]/g, 'ー'))
    .replace(/ヴ/g, 'ゔ')
    .toLowerCase();
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}

function candidatesAt(kana: string, i: number): { len: number; candidates: string[] } | null {
  const pair = kana.slice(i, i + 2);
  if (pair.length === 2 && DOUBLE[pair]) {
    const split = (SINGLE[pair[0]] ?? []).flatMap((a) => (SINGLE[pair[1]] ?? []).map((b) => a + b));
    return { len: 2, candidates: uniq([...DOUBLE[pair], ...split]) };
  }
  const c = kana[i];
  if (SINGLE[c]) return { len: 1, candidates: SINGLE[c] };
  if (/[a-z0-9!-/:-@[-`{-~]/.test(c)) return { len: 1, candidates: [c] };
  return null;
}

// ひらがなの文字列を、打つ単位に区切る。打てない文字と空白は取り除く。
export function toUnits(input: string): Unit[] {
  const kana = normalizeKana(input);
  const raw: Unit[] = [];
  for (let i = 0; i < kana.length; ) {
    const r = candidatesAt(kana, i);
    if (!r) {
      i += 1;
      continue;
    }
    raw.push({ kana: kana.slice(i, i + r.len), candidates: r.candidates });
    i += r.len;
  }

  const units: Unit[] = [];
  for (let i = 0; i < raw.length; i++) {
    const u = raw[i];
    const next = raw[i + 1];
    if (u.kana === 'っ' && next && next.kana !== 'っ') {
      // 促音は次の単位とまとめ、子音を重ねる打ち方と xtu などで分ける打ち方の両方を許す
      const doubled = next.candidates.filter((c) => /^[a-z]/.test(c) && !NO_DOUBLE.has(c[0])).map((c) => c[0] + c);
      const separate = u.candidates.flatMap((a) => next.candidates.map((b) => a + b));
      units.push({ kana: u.kana + next.kana, candidates: uniq([...doubled, ...separate]) });
      i++;
    } else if (u.kana === 'ん') {
      // 次が母音、な行、や行でなく、行末でもなければ n 1回で打てる
      const single = next && next.candidates.every((c) => !VOWELS_N_Y.has(c[0]) && /^[a-z]/.test(c));
      units.push({ kana: u.kana, candidates: single ? ['n', ...u.candidates] : u.candidates });
    } else {
      units.push(u);
    }
  }
  return units;
}

export type KeyResult = 'ok' | 'miss' | 'done';

// 1行分の入力状態を持つ。
export class RomajiMatcher {
  readonly units: Unit[];
  index = 0;
  buffer = '';

  constructor(kana: string) {
    this.units = toUnits(kana);
  }

  get finished(): boolean {
    return this.index >= this.units.length;
  }

  private tryUnit(key: string): boolean {
    const u = this.units[this.index];
    const next = this.buffer + key;
    if (!u.candidates.some((c) => c.startsWith(next))) return false;
    this.buffer = next;
    // 他に続きうる候補がなく、ちょうど一致したら単位を確定する
    if (u.candidates.includes(next) && !u.candidates.some((c) => c !== next && c.startsWith(next))) {
      this.index++;
      this.buffer = '';
    }
    return true;
  }

  input(rawKey: string): KeyResult {
    if (this.finished) return 'done';
    const key = rawKey.toLowerCase();
    if (this.tryUnit(key)) return this.finished ? 'done' : 'ok';
    // 今の単位が候補のどれかと一致していれば確定し、キーを次の単位に回す(例: ん を n 1回で打った場合)
    const u = this.units[this.index];
    const saved = this.buffer;
    if (saved && u.candidates.includes(saved)) {
      this.index++;
      this.buffer = '';
      if (!this.finished && this.tryUnit(key)) return this.finished ? 'done' : 'ok';
      // 次の単位でも外れたら、確定を取り消して元の状態に戻す
      this.index--;
      this.buffer = saved;
    }
    return 'miss';
  }

  // 打ち終えた部分と残りのローマ字を返す。
  display(): { typed: string; rest: string } {
    let typed = '';
    for (let i = 0; i < this.index; i++) typed += this.units[i].candidates[0];
    let rest = '';
    if (!this.finished) {
      const u = this.units[this.index];
      const c = u.candidates.find((x) => x.startsWith(this.buffer)) ?? u.candidates[0];
      typed += this.buffer;
      rest += c.slice(this.buffer.length);
      for (let i = this.index + 1; i < this.units.length; i++) rest += this.units[i].candidates[0];
    }
    return { typed, rest };
  }

  // 打ち終えた部分と残りの仮名を返す。
  kanaDisplay(): { typed: string; rest: string } {
    const typed = this.units.slice(0, this.index).map((u) => u.kana).join('');
    const rest = this.units.slice(this.index).map((u) => u.kana).join('');
    return { typed, rest };
  }

  // 残りの打鍵数の目安(表示中の候補の文字数)。
  remainingKeys(): number {
    return this.display().rest.length;
  }
}
