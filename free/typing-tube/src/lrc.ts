// LRC 形式の同期歌詞を行の配列にする。

export interface LrcLine {
  time: number; // 秒
  text: string;
}

const TAG = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g;

export function parseLrc(src: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const row of src.split(/\r?\n/)) {
    const times: number[] = [];
    let last = 0;
    for (const m of row.matchAll(TAG)) {
      times.push(Number(m[1]) * 60 + Number(m[2].replace(':', '.')));
      last = m.index! + m[0].length;
    }
    if (times.length === 0) continue;
    // 行内の単語ごとの時刻タグ <mm:ss.xx> は取り除く
    const text = row.slice(last).replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').trim();
    for (const time of times) lines.push({ time, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}
