// Firebase (Firestore) で、みんなの譜面と成績を共有する。
// 歌詞とひらがなは送らない。送るのは曲名、動画 ID、LRCLIB の歌詞 ID、各行の時刻、整形ルール、成績だけ。
// 歌詞は遊ぶ人のブラウザが LRCLIB から取得して組み立てる。
import { firebaseConfig } from './firebase-config';
import type { Result } from './game';
import { toHiragana } from './kana';
import { parseLrc } from './lrc';
import { getLrclib } from './lrclib';
import { applyRules, mergeShortLines, type ImportRules } from './transform';
import type { Chart } from './types';

export interface SharedChart {
  id: string;
  title: string;
  videoId: string;
  lrclibId: number;
  offset: number;
  rules: ImportRules;
  times: number[];
}

export interface Score {
  nickname: string;
  keys: number;
  misses: number;
  kps: number;
  accuracy: number;
}

export const cloudEnabled = firebaseConfig !== null;

type Firestore = typeof import('firebase/firestore');
let ready: Promise<{ fs: Firestore; db: import('firebase/firestore').Firestore; uid: string }> | null = null;

// 初めて使うときだけ Firebase を読み込み、匿名ログインする
function connect() {
  if (!firebaseConfig) return Promise.reject(new Error('Firebase が設定されていません'));
  ready ??= (async () => {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = initializeApp(firebaseConfig!);
    const cred = await auth.signInAnonymously(auth.getAuth(app));
    return { fs, db: fs.getFirestore(app), uid: cred.user.uid };
  })();
  ready.catch(() => (ready = null));
  return ready;
}

export async function listSharedCharts(): Promise<SharedChart[]> {
  const { fs, db } = await connect();
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'charts'), fs.orderBy('title'), fs.limit(500)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SharedChart, 'id'>) }));
}

// 譜面を共有する。sharedId があり自分が作ったものなら上書きし、なければ新しく作る。
export async function shareChart(chart: Chart): Promise<string> {
  if (!chart.lrclibId) throw new Error('LRCLIB から取り込んだ譜面だけ共有できます');
  const { fs, db, uid } = await connect();
  const data = {
    title: chart.title.slice(0, 100),
    videoId: chart.videoId,
    lrclibId: chart.lrclibId,
    offset: chart.offset,
    rules: {
      removeParens: Boolean(chart.rules?.removeParens),
      shift: chart.rules?.shift ?? 0,
      minSeconds: chart.rules?.minSeconds ?? 0,
    },
    times: chart.lines.map((l) => l.time),
    uid,
    updatedAt: fs.serverTimestamp(),
  };
  if (chart.sharedId) {
    try {
      await fs.setDoc(fs.doc(db, 'charts', chart.sharedId), data);
      return chart.sharedId;
    } catch {
      // 他の人が共有した譜面は上書きできないので、新しく共有する
    }
  }
  const ref = await fs.addDoc(fs.collection(db, 'charts'), data);
  return ref.id;
}

// 共有された譜面を、LRCLIB の歌詞と組み合わせて遊べる形にする
export async function buildChart(shared: SharedChart, newId: () => string): Promise<Chart> {
  const track = await getLrclib(shared.lrclibId);
  if (!track.syncedLyrics) throw new Error('LRCLIB に同期歌詞がありません');
  const parsed = parseLrc(track.syncedLyrics).map((l) => ({ time: l.time, lyric: l.text, kana: '' }));
  let lines = applyRules(parsed, { removeParens: shared.rules.removeParens, shift: shared.rules.shift });
  for (const l of lines) l.kana = l.lyric.trim() ? await toHiragana(l.lyric) : '';
  if (shared.rules.minSeconds) lines = mergeShortLines(lines, shared.rules.minSeconds);
  // 行の数が同じときだけ、共有された時刻を使う
  if (shared.times.length === lines.length) lines = lines.map((l, i) => ({ ...l, time: shared.times[i] }));
  return {
    id: newId(),
    title: shared.title,
    videoId: shared.videoId,
    offset: shared.offset,
    lines,
    lrclibId: shared.lrclibId,
    rules: shared.rules,
    sharedId: shared.id,
  };
}

export async function submitScore(chartId: string, nickname: string, r: Result): Promise<void> {
  const { fs, db, uid } = await connect();
  await fs.addDoc(fs.collection(db, 'scores'), {
    chartId,
    nickname: nickname.slice(0, 20),
    keys: r.keys,
    misses: r.misses,
    kps: Math.round(r.keysPerSecond * 100) / 100,
    accuracy: Math.round(r.accuracy * 10) / 10,
    uid,
    createdAt: fs.serverTimestamp(),
  });
}

// その譜面の成績を速い順に返す。並べ替えはブラウザで行い、Firestore の複合インデックスを不要にする
export async function listScores(chartId: string): Promise<Score[]> {
  const { fs, db } = await connect();
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'scores'), fs.where('chartId', '==', chartId), fs.limit(200)));
  return snap.docs
    .map((d) => d.data() as Score)
    .sort((a, b) => b.kps - a.kps || a.misses - b.misses)
    .slice(0, 20);
}
