// 譜面を localStorage に保存し、JSON ファイルとの間で読み書きする。
import type { Chart, ChartLine } from './types';

const KEY = 'typing-tube:charts';

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadCharts(): Chart[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Chart[]) : [];
  } catch {
    return [];
  }
}

function saveAll(charts: Chart[]): void {
  localStorage.setItem(KEY, JSON.stringify(charts));
}

export function saveChart(chart: Chart): void {
  const charts = loadCharts();
  const i = charts.findIndex((c) => c.id === chart.id);
  if (i >= 0) charts[i] = chart;
  else charts.push(chart);
  saveAll(charts);
}

export function deleteChart(id: string): void {
  saveAll(loadCharts().filter((c) => c.id !== id));
}

// JSON の中身を確かめて譜面にする。形が違えば例外を投げる。
export function parseChartJson(text: string): Chart {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.lines)) throw new Error('lines がありません');
  const lines: ChartLine[] = d.lines.map((l: Partial<ChartLine>, i: number) => {
    if (typeof l.time !== 'number') throw new Error(`${i + 1} 行目の time が数値ではありません`);
    return { time: l.time, lyric: String(l.lyric ?? ''), kana: String(l.kana ?? '') };
  });
  return {
    id: newId(),
    title: String(d.title ?? '無題'),
    videoId: String(d.videoId ?? ''),
    offset: Number(d.offset ?? 0),
    lines: lines.sort((a, b) => a.time - b.time),
  };
}

export function downloadChart(chart: Chart): void {
  const { id: _id, ...rest } = chart;
  const blob = new Blob([JSON.stringify(rest, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${chart.title || 'chart'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
