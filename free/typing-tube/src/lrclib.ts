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
