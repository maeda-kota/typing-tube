// 曲選択画面と画面の切り替え。
import './style.css';
import { buildChart, cloudEnabled, listSharedCharts } from './cloud';
import { h } from './dom';
import { showEditor } from './editor';
import { showPlay } from './play';
import { deleteChart, downloadChart, loadCharts, newId, parseChartJson, saveChart } from './storage';
import type { ImportRules } from './transform';

const root = document.querySelector<HTMLElement>('#app')!;

// 曲リストの1曲。歌詞は持たず、遊ぶ前にブラウザが LRCLIB から取得する。
interface CatalogSong {
  title: string;
  artists: string[];
  videoId: string;
  kind: string;
  rules?: ImportRules; // LRC を取り込んだときに自動でかける整形
}

let catalog: CatalogSong[] | null = null;

async function loadCatalog(): Promise<CatalogSong[]> {
  if (catalog) return catalog;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}catalog.json`);
    catalog = ((await res.json()) as { songs: CatalogSong[] }).songs;
  } catch {
    catalog = [];
  }
  return catalog;
}

// みんなが共有した譜面。共有されているのは時刻などだけで、歌詞は遊ぶ前に LRCLIB から取得して組み立てる。
function sharedSection(): HTMLElement {
  const status = h('p', { class: 'status' });
  const list = h('ul', { class: 'charts' }, h('li', {}, '読み込み中...'));
  void listSharedCharts()
    .then((shared) => {
      const charts = loadCharts();
      if (shared.length === 0) return list.replaceChildren(h('li', {}, 'まだ共有された譜面はありません。'));
      list.replaceChildren(
        ...shared.map((s) => {
          const local = charts.find((c) => c.sharedId === s.id);
          const play = async () => {
            if (local) return showPlay(root, local, showList);
            status.textContent = `「${s.title}」の歌詞を LRCLIB から取得して準備しています。初回は辞書の読み込みに時間がかかります...`;
            try {
              const chart = await buildChart(s, newId);
              saveChart(chart);
              showPlay(root, chart, showList);
            } catch (err) {
              status.textContent = `準備できませんでした: ${(err as Error).message}`;
            }
          };
          return h('li', {},
            h('span', { class: 'chart-title' }, s.title),
            h('button', { class: 'primary', onclick: play }, '遊ぶ'),
          );
        }),
      );
    })
    .catch((err: Error) => list.replaceChildren(h('li', {}, `読み込めませんでした: ${err.message}`)));
  return h('details', { class: 'catalog', open: true },
    h('summary', {}, 'みんなの譜面'),
    h('p', { class: 'hint' }, 'ほかの人が時刻を調整して共有した譜面です。歌詞はこのサイトには含まれず、遊ぶときにブラウザが LRCLIB から取得します。'),
    status,
    list,
  );
}

function catalogSection(): HTMLElement {
  const list = h('ul', { class: 'charts' }, h('li', {}, '読み込み中...'));
  void loadCatalog().then((songs) => {
    const charts = loadCharts();
    list.replaceChildren(
      ...songs.map((s) => {
        const saved = charts.find((c) => c.videoId === s.videoId);
        return h('li', {},
          h('span', { class: 'chart-title' }, `${s.title}`, h('span', { class: 'hint' }, ` ${s.artists[0]} / ${s.kind}`)),
          saved
            ? h('button', { class: 'primary', onclick: () => showPlay(root, saved, showList) }, '遊ぶ')
            : h('button', {
                onclick: () =>
                  showEditor(
                    root,
                    { id: newId(), title: `${s.title} / ${s.artists[0]}`, videoId: s.videoId, offset: 0, lines: [] },
                    showList,
                    { track: s.title, artists: s.artists, rules: s.rules },
                  ),
              }, '歌詞を取得して準備'),
        );
      }),
    );
  });
  return h('details', { class: 'catalog' },
    h('summary', {}, '曲リスト (新しい学校のリーダーズ)'),
    h('p', { class: 'hint' },
      '歌詞はこのサイトには含まれていません。「歌詞を取得して準備」を押すと、ブラウザが LRCLIB から同期歌詞を探し、選んだ歌詞でこのブラウザの中に譜面を作ります。'),
    list,
  );
}

async function addSample(): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}samples/sample.json`);
  saveChart(parseChartJson(await res.text()));
  showList();
}

function importJson(): void {
  const input = h('input', { type: 'file', accept: '.json,application/json' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const chart = parseChartJson(await file.text());
      // 行のない譜面は、歌詞を入れてもらうために編集画面で開く
      if (chart.lines.length === 0) return showEditor(root, chart, showList);
      saveChart(chart);
      showList();
    } catch (err) {
      alert(`読み込めませんでした: ${(err as Error).message}`);
    }
  });
  input.click();
}

function showList(): void {
  const charts = loadCharts();
  root.replaceChildren(
    h('section', { class: 'list' },
      h('h1', {}, '歌詞タイピング'),
      h('p', { class: 'hint' }, 'YouTube の動画を流しながら、歌詞をローマ字で打つゲームです。譜面はこのブラウザにだけ保存されます。'),
      h('div', { class: 'buttons' },
        h('button', { class: 'primary', onclick: () => showEditor(root, null, showList) }, '譜面を作る'),
        h('button', { onclick: importJson }, 'JSON を読み込む'),
        h('button', { onclick: addSample }, 'サンプルを追加'),
      ),
      cloudEnabled && sharedSection(),
      catalogSection(),
      h('h2', {}, '保存した譜面'),
      charts.length === 0
        ? h('p', {}, '譜面がまだありません。')
        : h('ul', { class: 'charts' },
            charts.map((c) =>
              h('li', {},
                h('span', { class: 'chart-title' }, c.title),
                h('button', { class: 'primary', onclick: () => showPlay(root, c, showList) }, '遊ぶ'),
                h('button', { onclick: () => showEditor(root, c, showList) }, '編集'),
                h('button', { onclick: () => downloadChart(c) }, 'JSON 保存'),
                h('button', { onclick: () => {
                  if (confirm(`「${c.title}」を消しますか？`)) {
                    deleteChart(c.id);
                    showList();
                  }
                } }, '削除'),
              ),
            ),
          ),
    ),
  );
}

showList();
