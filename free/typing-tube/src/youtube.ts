// 再生時刻を返す時計。YouTube の動画か、動画なしのタイマーのどちらかを使う。

export interface Clock {
  play(): void;
  pause(): void;
  time(): number; // 秒
  seek(t: number): void; // 秒
  ended(): boolean;
  destroy(): void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('YouTube の読み込みに失敗しました'));
    document.head.appendChild(s);
  });
  return apiPromise;
}

// URL か動画 ID から動画 ID を取り出す。
export function parseVideoId(input: string): string {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1, 12);
    const v = u.searchParams.get('v');
    if (v) return v;
    const m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
    if (m) return m[1];
  } catch {
    // URL でなければ空を返す
  }
  return '';
}

const ERRORS: Record<number, string> = {
  2: '動画 ID が正しくありません',
  5: 'この動画は再生できません',
  100: '動画が見つかりません',
  101: 'この動画は埋め込み再生が許可されていません',
  150: 'この動画は埋め込み再生が許可されていません',
};

// container の中に動画を作り、再生できる状態になったら返す。
export async function createYouTubeClock(
  container: HTMLElement,
  videoId: string,
  opts: { controls: boolean },
  onError: (msg: string) => void,
): Promise<Clock> {
  await loadApi();
  const el = document.createElement('div');
  container.replaceChildren(el);
  let ended = false;
  const player = await new Promise<any>((resolve) => {
    const p = new window.YT.Player(el, {
      videoId,
      playerVars: { controls: opts.controls ? 1 : 0, disablekb: opts.controls ? 0 : 1, rel: 0, playsinline: 1 },
      events: {
        onReady: () => resolve(p),
        onStateChange: (e: any) => {
          if (e.data === window.YT.PlayerState.ENDED) ended = true;
        },
        onError: (e: any) => onError(ERRORS[e.data] ?? `再生エラー (${e.data})`),
      },
    });
  });
  return {
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    time: () => player.getCurrentTime() ?? 0,
    seek: (t: number) => player.seekTo(t, true),
    ended: () => ended,
    destroy: () => player.destroy(),
  };
}

// 動画なしの譜面や、動作確認に使うタイマー。
export function createTimerClock(): Clock {
  let base = 0;
  let startedAt: number | null = null;
  return {
    play() {
      startedAt ??= performance.now();
    },
    pause() {
      if (startedAt !== null) base += (performance.now() - startedAt) / 1000;
      startedAt = null;
    },
    time: () => base + (startedAt === null ? 0 : (performance.now() - startedAt) / 1000),
    seek(t: number) {
      base = t;
      if (startedAt !== null) startedAt = performance.now();
    },
    ended: () => false,
    destroy() {},
  };
}
