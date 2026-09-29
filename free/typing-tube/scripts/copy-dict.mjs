// kuromoji のブラウザ向けビルドと辞書を public にコピーする。辞書は 18MB あるのでリポジトリには入れない。
// .gz のままだと、配信側が Content-Encoding: gzip を付けてブラウザが先に解凍し、kuromoji の解凍が失敗する。
// そのため辞書は拡張子を .bin に変えて置き、kuromoji が読むファイル名も合わせて書き換える。
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const DICT_SRC = 'node_modules/kuromoji/dict';
const DICT_DEST = 'public/dict';
const VENDOR = 'public/vendor/kuromoji.js';

mkdirSync(DICT_DEST, { recursive: true });
for (const name of readdirSync(DICT_SRC)) {
  const dest = `${DICT_DEST}/${name.replace(/\.gz$/, '.bin')}`;
  if (!existsSync(dest)) copyFileSync(`${DICT_SRC}/${name}`, dest);
}

mkdirSync('public/vendor', { recursive: true });
const js = readFileSync('node_modules/kuromoji/build/kuromoji.js', 'utf8').replace(/\.dat\.gz"/g, '.dat.bin"');
writeFileSync(VENDOR, js);
console.log(`prepared ${DICT_DEST} and ${VENDOR}`);
