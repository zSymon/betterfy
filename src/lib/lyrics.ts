// Songtexte über LRCLIB (offene, freie Lyrics-Datenbank) – Spotify bietet keine öffentliche Lyrics-API.
export type LyricLine = { time: number; text: string };
export type Lyrics = { synced: boolean; lines: LyricLine[]; instrumental?: boolean };

const memo = new Map<string, Lyrics | null>();

type LrcRecord = { syncedLyrics?: string | null; plainLyrics?: string | null; instrumental?: boolean };

function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) out.push({ time: (Number(m[1]) * 60 + Number(m[2])) * 1000, text });
  }
  return out.sort((a, b) => a.time - b.time);
}

export async function fetchLyrics(q: { track: string; artist: string; album?: string; durationMs: number }): Promise<Lyrics | null> {
  const key = `${q.artist}|${q.track}`;
  if (memo.has(key)) return memo.get(key)!;

  const params = new URLSearchParams({
    track_name: q.track,
    artist_name: q.artist,
    duration: String(Math.round(q.durationMs / 1000)),
  });
  if (q.album) params.set('album_name', q.album);

  let result: Lyrics | null = null;
  try {
    let res = await fetch(`https://lrclib.net/api/get?${params}`);
    let data: LrcRecord | null = null;
    if (res.ok) data = await res.json();
    else {
      // Unscharfe Suche als Fallback (z.B. "– Remastered"-Titel)
      const cleanTitle = q.track.replace(/\s*[-–(\[].*(remaster|version|edit|live|mix|feat).*$/i, '').trim();
      res = await fetch(`https://lrclib.net/api/search?${new URLSearchParams({ track_name: cleanTitle, artist_name: q.artist })}`);
      if (res.ok) {
        const list = (await res.json()) as LrcRecord[];
        data = list.find((d) => d?.syncedLyrics) ?? list[0] ?? null;
      }
    }
    if (data?.instrumental) result = { synced: false, lines: [], instrumental: true };
    else if (data?.syncedLyrics) result = { synced: true, lines: parseLrc(data.syncedLyrics) };
    else if (data?.plainLyrics)
      result = { synced: false, lines: data.plainLyrics.split(/\r?\n/).map((text) => ({ time: -1, text })) };
  } catch {
    result = null;
  }
  memo.set(key, result);
  return result;
}
