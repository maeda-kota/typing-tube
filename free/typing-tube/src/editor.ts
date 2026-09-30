// 譜面作成画面。LRC を取り込み、ひらがなとタイミングを直して保存する。
import { formatTime, h } from './dom';
import { toHiragana } from './kana';
import { parseLrc } from './lrc';
import { searchLrclib, type LrclibTrack } from './lrclib';
import { newId, saveChart } from './storage';
import { applyRules, mergeShortLines, removeParensFromLines, shiftLines, type ImportRules } from './transform';
import type { Chart, ChartLine } from './types';
import { createYouTubeClock, parseVideoId, type Clock } from './youtube';

// 曲リストから開いたときに、LRCLIB の検索欄へ入れる値。artists は先頭から順に試す。
export interface SearchHint {
  track: string;
  artists: string[];
  rules?: ImportRules; // LRC を取り込んだときに自動でかける整形
}

export function showEditor(root: HTMLElement, original: Chart | null, onExit: () => void, hint?: SearchHint): void {
  const chart: Chart = original
    ? structuredClone(original)
    : { id: newId(), title: '', videoId: '', offset: 0, lines: [] };

  let clock: Clock | null = null;
  let timer = 0;

  const status = h('p', { class: 'status' });
  const setStatus = (msg: string) => (status.textContent = msg);

  // 基本情報
  const titleInput = h('input', { type: 'text', value: chart.title, placeholder: '曲名', oninput: () => (chart.title = titleInput.value) });
  const urlInput = h('input', {
    type: 'text',
    value: chart.videoId ? `https://www.youtube.com/watch?v=${chart.videoId}` : '',
    placeholder: 'https://www.youtube.com/watch?v=...',
  });

  // 動画のプレビュー
  const preview = h('div', { class: 'video' });
  const previewLine = h('div', { class: 'preview-line' });
  const loadVideo = async () => {
    const id = parseVideoId(urlInput.value);
    if (!id) return setStatus('YouTube の URL を読み取れませんでした');
    chart.videoId = id;
    clock?.destroy();
    clock = null;
    try {
      clock = await createYouTubeClock(preview, id, { controls: true }, setStatus);
      setStatus('動画を読み込みました。再生しながら歌詞とのずれを確認できます');
    } catch (err) {
      setStatus((err as Error).message);
    }
  };
  const tick = () => {
    if (clock) {
      const t = clock.time();
      let cur: ChartLine | undefined;
      for (const l of chart.lines) if (l.time + chart.offset <= t) cur = l;
      previewLine.textContent = `${formatTime(t)}  ${cur ? cur.lyric : ''}`;
    }
    timer = requestAnimationFrame(tick);
  };
  timer = requestAnimationFrame(tick);

  // タイミング補正
  const offsetInput = h('input', {
    type: 'number',
    step: '0.1',
    value: String(chart.offset),
    oninput: () => (chart.offset = Number(offsetInput.value) || 0),
  });
  const nudge = (d: number) => {
    chart.offset = Math.round((chart.offset + d) * 10) / 10;
    offsetInput.value = String(chart.offset);
  };

  // 行の表
  const tbody = h('tbody');
  const renderLines = () => {
    tbody.replaceChildren(
      ...chart.lines.map((line, i) => {
        const time = h('input', { type: 'number', step: '0.01', value: line.time.toFixed(2), class: 'time',
          onchange: () => (line.time = Number(time.value) || 0) });
        const lyric = h('input', { type: 'text', value: line.lyric, oninput: () => (line.lyric = lyric.value) });
        const kana = h('input', { type: 'text', value: line.kana, oninput: () => (line.kana = kana.value) });
        return h('tr', {},
          h('td', {}, time),
          h('td', {}, lyric),
          h('td', {}, kana),
          h('td', { class: 'row-buttons' },
            h('button', {
              title: '動画の今の再生時刻をこの行の開始にする',
              onclick: () => {
                if (!clock) return setStatus('先に動画を読み込んでください');
                line.time = Math.max(0, Math.round((clock.time() - chart.offset) * 100) / 100);
                renderLines();
              },
            }, '今'),
            h('button', { title: '下に行を追加', onclick: () => {
              chart.lines.splice(i + 1, 0, { time: line.time, lyric: '', kana: '' });
              renderLines();
            } }, '+'),
            h('button', { title: 'この行を消す', onclick: () => {
              chart.lines.splice(i, 1);
              renderLines();
            } }, '×'),
          ),
        );
      }),
    );
  };

  const convertAll = async (onlyEmpty: boolean) => {
    setStatus('読みを変換しています。初回は辞書の読み込みに時間がかかります...');
    try {
      for (const line of chart.lines) {
        if (onlyEmpty && line.kana) continue;
        line.kana = await toHiragana(line.lyric);
      }
      setStatus('ひらがなに変換しました。読みが違う箇所は手で直してください');
    } catch (err) {
      setStatus(`変換に失敗しました: ${(err as Error).message}`);
    }
    renderLines();
  };

  const importLrc = async (lrc: string) => {
    const lines = parseLrc(lrc);
    if (lines.length === 0) return setStatus('時刻付きの行が見つかりませんでした');
    const rules = hint?.rules ?? {};
    // カッコの削除と時刻のずらしは読みの変換前に、結合は読みができてから行う
    chart.lines = applyRules(
      lines.map((l) => ({ time: l.time, lyric: l.text, kana: '' })),
      { removeParens: rules.removeParens, shift: rules.shift },
    );
    renderLines();
    await convertAll(true);
    if (rules.minSeconds) {
      chart.lines = mergeShortLines(chart.lines, rules.minSeconds);
      renderLines();
    }
  };

  // 保存済みの譜面にも同じ整形をかけられるボタン
  const transformButtons = h('div', { class: 'inline' },
    h('button', { onclick: () => {
      chart.lines = removeParensFromLines(chart.lines);
      renderLines();
      setStatus('カッコ内を削除しました');
    } }, 'カッコ内を削除'),
    h('button', { onclick: () => {
      chart.lines = shiftLines(chart.lines, -0.3);
      renderLines();
      setStatus('全行の時刻を 0.3 秒早めました');
    } }, '全行を -0.3 秒'),
    h('button', { onclick: () => {
      const before = chart.lines.length;
      chart.lines = mergeShortLines(chart.lines, 4);
      renderLines();
      setStatus(`4 秒未満の行を結合しました (${before} 行 → ${chart.lines.length} 行)`);
    } }, '4 秒未満の行を結合'),
  );

  // LRCLIB 検索
  const trackInput = h('input', { type: 'text', placeholder: '曲名', value: hint?.track ?? '' });
  const artistInput = h('input', { type: 'text', placeholder: 'アーティスト名', value: hint?.artists[0] ?? '' });
  const results = h('ul', { class: 'results' });
  const search = async () => {
    setStatus('LRCLIB を検索しています...');
    results.replaceChildren();
    try {
      // アーティスト名は、入力欄の値のあと曲リストの別表記も順に試す
      const artists = [artistInput.value.trim(), ...(hint?.artists ?? [])].filter((a, i, xs) => xs.indexOf(a) === i);
      let list: LrclibTrack[] = [];
      for (const artist of artists) {
        list = await searchLrclib(trackInput.value.trim(), artist);
        if (list.length > 0) break;
      }
      if (list.length === 0) return setStatus('同期歌詞のある曲が見つかりませんでした。LRC の貼り付けも使えます');
      setStatus(`${list.length} 件見つかりました。使う曲を選んでください`);
      results.replaceChildren(...list.map((t: LrclibTrack) =>
        h('li', {}, h('button', {
          onclick: () => {
            if (!chart.title) titleInput.value = chart.title = `${t.trackName} / ${t.artistName}`;
            results.replaceChildren();
            void importLrc(t.syncedLyrics ?? '');
          },
        }, `${t.artistName} - ${t.trackName} (${t.albumName}, ${formatTime(t.duration)})`)),
      ));
    } catch (err) {
      setStatus(`検索できませんでした (${(err as Error).message})。LRC を貼り付けて取り込んでください`);
    }
  };

  const lrcArea = h('textarea', { rows: 6, placeholder: '[00:12.34]歌詞 の形式の LRC を貼り付け' });

  const leave = () => {
    cancelAnimationFrame(timer);
    clock?.destroy();
    onExit();
  };
  const save = () => {
    chart.title = titleInput.value.trim() || '無題';
    chart.videoId = parseVideoId(urlInput.value);
    chart.lines.sort((a, b) => a.time - b.time);
    if (chart.lines.length === 0) return setStatus('行が1つもありません');
    saveChart(chart);
    leave();
  };

  root.replaceChildren(
    h('section', { class: 'editor' },
      h('h2', {}, original ? '譜面を編集' : '譜面を作る'),
      h('label', {}, '曲名', titleInput),
      h('label', {}, 'YouTube の URL', h('div', { class: 'inline' }, urlInput, h('button', { onclick: loadVideo }, '動画を読み込む'))),
      preview,
      previewLine,
      h('fieldset', {},
        h('legend', {}, 'LRCLIB から歌詞を探す'),
        h('div', { class: 'inline' }, trackInput, artistInput, h('button', { onclick: search }, '検索')),
        results,
      ),
      h('fieldset', {},
        h('legend', {}, 'LRC を貼り付ける'),
        lrcArea,
        h('button', { onclick: () => importLrc(lrcArea.value) }, '取り込む'),
      ),
      h('fieldset', {},
        h('legend', {}, 'タイミング補正 (秒、プラスで歌詞が遅れて出る)'),
        h('div', { class: 'inline' },
          h('button', { onclick: () => nudge(-0.5) }, '-0.5'),
          h('button', { onclick: () => nudge(-0.1) }, '-0.1'),
          offsetInput,
          h('button', { onclick: () => nudge(0.1) }, '+0.1'),
          h('button', { onclick: () => nudge(0.5) }, '+0.5'),
        ),
      ),
      status,
      transformButtons,
      h('div', { class: 'inline' },
        h('button', { onclick: () => convertAll(false) }, 'ひらがなを全部作り直す'),
        h('button', { onclick: () => {
          chart.lines.push({ time: chart.lines.at(-1)?.time ?? 0, lyric: '', kana: '' });
          renderLines();
        } }, '行を追加'),
      ),
      h('table', { class: 'lines' },
        h('thead', {}, h('tr', {}, h('th', {}, '時刻(秒)'), h('th', {}, '歌詞'), h('th', {}, 'ひらがな'), h('th', {}))),
        tbody,
      ),
      h('p', { class: 'hint' }, 'ひらがなが空の行は間奏として扱い、入力しません。曲の終わりには空の行を置いてください。'),
      h('div', { class: 'buttons' },
        h('button', { class: 'primary', onclick: save }, '保存'),
        h('button', { onclick: leave }, 'やめる'),
      ),
    ),
  );
  renderLines();
  // 曲リストから開いたときは、動画の読み込みと LRCLIB の検索をすぐに始める
  // 状態表示を検索結果で終えるため、動画を読み込んでから検索する
  if (hint) void loadVideo().then(search);
}
