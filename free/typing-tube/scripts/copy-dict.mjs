// kuromoji のブラウザ向けビルドと辞書を public にコピーする。辞書は 18MB あるのでリポジトリには入れない。
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const copies = [
  ['node_modules/kuromoji/dict', 'public/dict'],
  ['node_modules/kuromoji/build/kuromoji.js', 'public/vendor/kuromoji.js'],
];

mkdirSync('public/vendor', { recursive: true });
for (const [src, dest] of copies) {
  if (existsSync(dest)) continue;
  cpSync(src, dest, { recursive: true });
  console.log(`copied ${src} -> ${dest}`);
}
