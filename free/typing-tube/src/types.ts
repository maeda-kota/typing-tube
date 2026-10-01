import type { ImportRules } from './transform';

// 譜面の1行。kana が空の行は間奏として扱い、入力しない。
export interface ChartLine {
  time: number; // 秒。動画の再生時刻
  lyric: string; // 画面に出す歌詞
  kana: string; // 入力するひらがな
}

export interface Chart {
  id: string;
  title: string;
  videoId: string; // 空なら動画なしで、時計だけで進む
  offset: number; // 秒。全行の時刻にこの値を足す
  lines: ChartLine[];
  lrclibId?: number; // 取り込んだ LRCLIB の歌詞 ID。共有するときに使う
  rules?: ImportRules; // 取り込んだときにかけた整形
  sharedId?: string; // みんなの譜面に共有した、または共有から取り込んだときの ID
}
