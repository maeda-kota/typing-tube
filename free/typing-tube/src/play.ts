// プレイ画面と結果画面。
import { cloudEnabled, listScores, submitScore } from './cloud';
import { h } from './dom';
import { Game, type Result } from './game';
import type { Chart } from './types';
import { createTimerClock, createYouTubeClock, type Clock } from './youtube';

export function showPlay(root: HTMLElement, chart: Chart, onExit: () => void): void {
  const game = new Game(chart);
  const video = h('div', { class: 'video' });
  const message = h('div', { class: 'message' }, '読み込み中...');
  const lyric = h('div', { class: 'lyric' });
  const kana = h('div', { class: 'kana' });
  const romaji = h('div', { class: 'romaji' });
  const bar = h('div', { class: 'bar-fill' });
  const next = h('div', { class: 'next' });
  const stats = h('div', { class: 'stats' });

  root.replaceChildren(
    h('section', { class: 'play' },
      h('div', { class: 'play-head' }, h('h2', {}, chart.title), h('span', { class: 'hint' }, 'Esc で中断')),
      video,
      message,
      h('div', { class: 'board' }, lyric, kana, romaji, h('div', { class: 'bar' }, bar), next),
      stats,
    ),
  );

  let clock: Clock | null = null;
  let started = false;
  let finished = false;
  let raf = 0;

  const cleanup = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    clock?.destroy();
  };

  const render = (t: number) => {
    const line = game.line;
    if (line?.matcher) {
      const k = line.matcher.kanaDisplay();
      const r = line.matcher.display();
      lyric.textContent = line.lyric;
      kana.replaceChildren(h('span', { class: 'typed' }, k.typed), k.rest);
      romaji.replaceChildren(h('span', { class: 'typed' }, r.typed), r.rest);
      romaji.classList.toggle('cleared', line.matcher.finished);
    } else {
      lyric.textContent = line ? line.lyric || '(間奏)' : '';
      kana.textContent = '';
      romaji.textContent = '';
    }
    const cur = line ?? game.lines[0];
    if (cur) {
      const span = line ? cur.end - cur.start : cur.start;
      const done = line ? t - cur.start : t;
      bar.style.width = `${Math.min(100, Math.max(0, (done / span) * 100))}%`;
    }
    next.textContent = game.nextLine ? `次: ${game.nextLine.lyric}` : '';
    stats.textContent = `打鍵 ${game.keys}  ミス ${game.misses}`;
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    game.update(Number.POSITIVE_INFINITY);
    cleanup();
    showResult(root, chart, game.result(), onExit);
  };

  const loop = () => {
    const t = clock!.time();
    if (game.update(t) || clock!.ended()) return finish();
    render(t);
    raf = requestAnimationFrame(loop);
  };

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cleanup();
      onExit();
      return;
    }
    if (!clock) return;
    if (!started) {
      if (e.key === ' ') {
        e.preventDefault();
        started = true;
        message.textContent = '';
        clock.play();
        raf = requestAnimationFrame(loop);
      }
      return;
    }
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const r = game.key(e.key, clock.time());
    if (r === 'miss') {
      romaji.classList.remove('shake');
      void romaji.offsetWidth; // アニメーションをやり直すため
      romaji.classList.add('shake');
    }
    render(clock.time());
  }
  window.addEventListener('keydown', onKey);

  const ready = (c: Clock) => {
    clock = c;
    message.textContent = 'スペースキーで開始';
    render(0);
  };
  if (chart.videoId) {
    createYouTubeClock(video, chart.videoId, { controls: false }, (msg) => (message.textContent = msg))
      .then(ready)
      .catch((err: Error) => (message.textContent = err.message));
  } else {
    video.replaceChildren(h('div', { class: 'no-video' }, '動画なし'));
    ready(createTimerClock());
  }
}

function showResult(root: HTMLElement, chart: Chart, r: Result, onExit: () => void): void {
  const row = (label: string, value: string) => h('tr', {}, h('th', {}, label), h('td', {}, value));
  root.replaceChildren(
    h('section', { class: 'result' },
      h('h2', {}, `結果: ${chart.title}`),
      h('table', {},
        row('打鍵数', `${r.keys}`),
        row('ミス数', `${r.misses}`),
        row('速度', `${r.keysPerSecond.toFixed(2)} 打/秒`),
        row('正確率', `${r.accuracy.toFixed(1)} %`),
        row('打ち残し', `${r.leftKeys} 打`),
        row('打ち切った行', `${r.clearedLines} / ${r.totalLines}`),
      ),
      h('p', { class: 'hint' }, '速度は、正しく打った数を各行で打っていた時間の合計で割った値です。'),
      h('div', { class: 'buttons' },
        h('button', { onclick: () => showPlay(root, chart, onExit) }, 'もう一度'),
        h('button', { onclick: onExit }, '曲選択へ戻る'),
      ),
      cloudEnabled && chart.sharedId ? rankingSection(chart.sharedId, r) : null,
    ),
  );
}

const NICKNAME_KEY = 'typing-tube:nickname';

// 共有された譜面のときだけ、成績の登録とランキングを出す
function rankingSection(chartId: string, r: Result): HTMLElement {
  let saved = '';
  try {
    saved = localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    // 保存できない環境では毎回入力してもらう
  }
  const nickname = h('input', { type: 'text', value: saved, placeholder: 'ニックネーム (20 文字まで)', maxLength: 20 });
  const status = h('p', { class: 'status' });
  const table = h('tbody');
  const load = async () => {
    try {
      const scores = await listScores(chartId);
      table.replaceChildren(
        ...scores.map((s, i) =>
          h('tr', {},
            h('td', {}, `${i + 1}`),
            h('td', {}, s.nickname),
            h('td', {}, `${s.kps.toFixed(2)} 打/秒`),
            h('td', {}, `ミス ${s.misses}`),
            h('td', {}, `${s.accuracy.toFixed(1)} %`),
          ),
        ),
      );
      if (scores.length === 0) status.textContent = 'まだ成績がありません';
    } catch (err) {
      status.textContent = `ランキングを読み込めませんでした: ${(err as Error).message}`;
    }
  };
  const submit = async () => {
    const name = nickname.value.trim();
    if (!name) return (status.textContent = 'ニックネームを入れてください');
    try {
      localStorage.setItem(NICKNAME_KEY, name);
    } catch {
      // 保存できなくても登録は続ける
    }
    button.disabled = true;
    try {
      await submitScore(chartId, name, r);
      status.textContent = '登録しました';
      await load();
    } catch (err) {
      button.disabled = false;
      status.textContent = `登録できませんでした: ${(err as Error).message}`;
    }
  };
  const button = h('button', { class: 'primary', onclick: submit }, 'ランキングに登録');
  void load();
  return h('section', { class: 'ranking' },
    h('h3', {}, 'ランキング (速度順)'),
    h('div', { class: 'inline' }, nickname, button),
    status,
    h('table', {}, table),
  );
}
