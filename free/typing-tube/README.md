# 歌詞タイピング

YouTube の動画を流しながら、歌詞をローマ字で打つタイピングゲームです。登録やログインはなく、譜面はブラウザの localStorage に保存されます。

## 遊び方

1. 曲選択画面で「譜面を作る」を押します。
2. YouTube の URL を入れて「動画を読み込む」を押します。
3. LRCLIB で曲名とアーティスト名を検索するか、LRC を貼り付けて取り込みます。漢字は自動でひらがなになるので、読みが違う箇所を直します。
4. 動画を再生して歌詞のずれを確認し、タイミング補正か各行の「今」ボタンで合わせます。
5. 保存して「遊ぶ」を押し、スペースキーで始めます。Esc で中断できます。

終わると、打鍵数、ミス数、速度(打/秒)、正確率、打ち残しが出ます。速度は、正しく打った数を、各行の開始から打ち終えるか時間切れになるまでの時間の合計で割った値です。

ローマ字は shi/si、tsu/tu、ja/zya/jya、促音の tte/xtute、子音の前の ん を n 1回で打つ、などの揺れを受け付けます。

## 譜面の JSON

LRC が見つからない曲は、次の形の JSON を書いて「JSON を読み込む」から取り込めます。`kana` が空の行は間奏として扱い、入力しません。曲の終わりには空の行を置いてください。

```json
{
  "title": "曲名",
  "videoId": "YouTube の動画 ID(11文字)",
  "offset": 0,
  "lines": [
    { "time": 12.3, "lyric": "表示する歌詞", "kana": "にゅうりょくするかな" },
    { "time": 20.0, "lyric": "", "kana": "" }
  ]
}
```

歌詞には著作権があるため、作った譜面を公開の場所に置かないでください。

## 開発

```sh
npm install
npm run dev     # 開発サーバー
npm test        # ローマ字判定、LRC 解析、集計のテスト
npm run build   # dist に出力
```

`npm run dev` と `npm run build` は、kuromoji のブラウザ向けビルドと辞書(約 18MB)を `public/` にコピーしてから動きます。

## GitHub Pages への公開

`.github/workflows/deploy-typing-tube.yml` が、main ブランチへの push でビルドして公開します。初回だけ、リポジトリの Settings → Pages で Source を GitHub Actions にしてください。
