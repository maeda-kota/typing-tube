// LRCLIB (https://lrclib.net) から同期歌詞を検索する。

export interface LrclibTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  syncedLyrics: string | null;
}

export async function searchLrclib(track: string, artist: string): Promise<LrclibTrack[]> {
  const params = new URLSearchParams();
  if (track) params.set('track_name', track);
  if (artist) params.set('artist_name', artist);
  const res = await fetch(`https://lrclib.net/api/search?${params}`);
  if (!res.ok) throw new Error(`LRCLIB の検索に失敗しました (${res.status})`);
  const list = (await res.json()) as LrclibTrack[];
  return list.filter((t) => t.syncedLyrics);
}

// ID を指定して1曲取得する。共有された譜面を組み立てるときに使う。
export async function getLrclib(id: number): Promise<LrclibTrack> {
  const res = await fetch(`https://lrclib.net/api/get/${id}`);
  if (!res.ok) throw new Error(`LRCLIB から歌詞を取得できませんでした (${res.status})`);
  return (await res.json()) as LrclibTrack;
}
