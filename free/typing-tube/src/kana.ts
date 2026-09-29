// 歌詞の漢字をひらがなに変換する。kuromoji のブラウザ向けビルドと辞書を必要になったときだけ読み込む。

interface Token {
  surface_form: string;
  reading?: string;
}
interface Tokenizer {
  tokenize(text: string): Token[];
}

declare global {
  interface Window {
    kuromoji?: {
      builder(opts: { dicPath: string }): { build(cb: (err: Error | null, t: Tokenizer) => void): void };
    };
  }
}

const BASE = import.meta.env.BASE_URL;
let tokenizerPromise: Promise<Tokenizer> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`${src} を読み込めませんでした`));
    document.head.appendChild(s);
  });
}

function getTokenizer(): Promise<Tokenizer> {
  tokenizerPromise ??= (async () => {
    if (!window.kuromoji) await loadScript(`${BASE}vendor/kuromoji.js`);
    return new Promise<Tokenizer>((resolve, reject) => {
      window.kuromoji!.builder({ dicPath: `${BASE}dict/` }).build((err, t) => (err ? reject(err) : resolve(t)));
    });
  })();
  tokenizerPromise.catch(() => (tokenizerPromise = null));
  return tokenizerPromise;
}

function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const HAS_KANJI = /[㐀-鿿々]/;

export async function toHiragana(text: string): Promise<string> {
  const tokenizer = await getTokenizer();
  return tokenizer
    .tokenize(text)
    .map((t) => {
      // 読みがあり漢字を含む語だけ読みに置き換える。それ以外は表記のまま使う
      if (t.reading && t.reading !== '*' && HAS_KANJI.test(t.surface_form)) return kataToHira(t.reading);
      return kataToHira(t.surface_form);
    })
    .join('');
}
