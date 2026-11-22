import { aura } from './bridge';
// Spotify Web API Client – nutzt nur Endpunkte, die für Development-Mode-Apps (seit Feb. 2026) erlaubt sind.
import type {
  Album,
  AlbumRef,
  Artist,
  CursorPaging,
  Device,
  Episode,
  Paging,
  PlaybackState,
  Playlist,
  PlaylistEntry,
  PlaylistRef,
  Track,
  User,
} from './types';

const BASE = 'https://api.spotify.com/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class AuthRequired extends Error {}

const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 90_000;

export function invalidate(prefix = '') {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

type ReqInit = { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined>; cache?: boolean };

export async function api<T>(path: string, init: ReqInit = {}, attempt = 0): Promise<T> {
  const method = init.method ?? 'GET';
  const url = new URL(path.startsWith('http') ? path : BASE + path);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const key = url.toString();

  const useCache = method === 'GET' && init.cache !== false;
  if (useCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;
  }

  const token = await aura().getToken(attempt > 0);
  if (!token) throw new AuthRequired('Nicht angemeldet');

  const res = await fetch(key, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401 && attempt === 0) return api<T>(path, init, 1);
  if (res.status === 429 && attempt < 3) {
    const wait = Number(res.headers.get('Retry-After') ?? '2');
    await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
    return api<T>(path, init, attempt + 1);
  }
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? j?.error_description ?? msg;
    } catch {
      /* leer */
    }
    throw new ApiError(res.status, msg);
  }

  const text = await res.text();
  const data = (text ? JSON.parse(text) : undefined) as T;
  if (useCache) cache.set(key, { at: Date.now(), data });
  return data;
}

/** Lädt alle Seiten einer Paging-Ressource (mit Obergrenze). */
export async function all<T>(first: Paging<T> | CursorPaging<T>, max = 2000): Promise<T[]> {
  const out = [...first.items];
  let next = first.next;
  while (next && out.length < max) {
    const page = await api<Paging<T>>(next);
    out.push(...page.items);
    next = page.next;
  }
  return out;
}

// ---------- Nutzer & Bibliothek ----------
export const me = () => api<User>('/me');

export const myPlaylists = (offset = 0) => api<Paging<PlaylistRef>>('/me/playlists', { query: { limit: 50, offset } });

export const savedTracks = (offset = 0, limit = 50) =>
  api<Paging<{ added_at: string; track: Track }>>('/me/tracks', { query: { limit, offset } });

export const savedAlbums = (offset = 0) =>
  api<Paging<{ added_at: string; album: AlbumRef }>>('/me/albums', { query: { limit: 50, offset } });

export const followedArtists = (after?: string) =>
  api<{ artists: CursorPaging<Artist> }>('/me/following', { query: { type: 'artist', limit: 50, after } });

export const recentlyPlayed = () =>
  api<CursorPaging<{ played_at: string; track: Track; context: { uri: string; type: string } | null }>>(
    '/me/player/recently-played',
    { query: { limit: 50 } },
  );

export const topArtists = (range: 'short_term' | 'medium_term' | 'long_term' = 'short_term') =>
  api<Paging<Artist>>('/me/top/artists', { query: { limit: 20, time_range: range } });

export const topTracks = (range: 'short_term' | 'medium_term' | 'long_term' = 'short_term') =>
  api<Paging<Track>>('/me/top/tracks', { query: { limit: 20, time_range: range } });

// Neue generische Library-Endpunkte (max. 40 URIs pro Aufruf)
export const libraryContains = (uris: string[]) =>
  api<boolean[]>('/me/library/contains', { query: { uris: uris.slice(0, 40).join(',') }, cache: false });

export async function librarySave(uris: string[]) {
  await api('/me/library', { method: 'PUT', query: { uris: uris.slice(0, 40).join(',') } });
  invalidate(`${BASE}/me/tracks`);
  invalidate(`${BASE}/me/albums`);
}

export async function libraryRemove(uris: string[]) {
  await api('/me/library', { method: 'DELETE', query: { uris: uris.slice(0, 40).join(',') } });
  invalidate(`${BASE}/me/tracks`);
  invalidate(`${BASE}/me/albums`);
}

// ---------- Inhalte ----------
export const playlist = (id: string) => api<Playlist>(`/playlists/${id}`);

/** Nur für eigene/kollaborative Playlists erlaubt (403 sonst). */
export const playlistItems = (id: string, offset = 0) =>
  api<Paging<PlaylistEntry>>(`/playlists/${id}/items`, { query: { limit: 50, offset, additional_types: 'track,episode' } });

export const album = (id: string) => api<Album>(`/albums/${id}`);
export const artist = (id: string) => api<Artist>(`/artists/${id}`);
export const artistAlbums = (id: string) =>
  api<Paging<AlbumRef>>(`/artists/${id}/albums`, { query: { include_groups: 'album,single', limit: 30 } });
export const track = (id: string) => api<Track>(`/tracks/${id}`);

export type SearchResult = {
  tracks?: Paging<Track>;
  artists?: Paging<Artist>;
  albums?: Paging<AlbumRef>;
  playlists?: Paging<PlaylistRef | null>;
};

// Seit 2026: max. 10 Ergebnisse pro Typ und Seite
export const search = (q: string, offset = 0) =>
  api<SearchResult>('/search', { query: { q, type: 'track,artist,album,playlist', limit: 10, offset } });

// ---------- Player ----------
const P = '/me/player';

export const playbackState = () =>
  api<PlaybackState | undefined>(P, { query: { additional_types: 'episode' }, cache: false });

export const devices = () => api<{ devices: Device[] }>(`${P}/devices`, { cache: false });

export const queue = () =>
  api<{ currently_playing: Track | Episode | null; queue: (Track | Episode)[] }>(`${P}/queue`, { cache: false });

export const transfer = (deviceId: string, play = true) =>
  api(P, { method: 'PUT', body: { device_ids: [deviceId], play } });

export type PlayRequest = { context_uri?: string; uris?: string[]; offset?: { uri: string } | { position: number }; position_ms?: number };

export const play = (req: PlayRequest | undefined, deviceId?: string) =>
  api(`${P}/play`, { method: 'PUT', body: req ?? {}, query: { device_id: deviceId } });

export const pause = (deviceId?: string) => api(`${P}/pause`, { method: 'PUT', query: { device_id: deviceId } });
export const next = (deviceId?: string) => api(`${P}/next`, { method: 'POST', query: { device_id: deviceId } });
export const previous = (deviceId?: string) => api(`${P}/previous`, { method: 'POST', query: { device_id: deviceId } });
export const seek = (ms: number, deviceId?: string) =>
  api(`${P}/seek`, { method: 'PUT', query: { position_ms: Math.round(ms), device_id: deviceId } });
export const setVolume = (pct: number, deviceId?: string) =>
  api(`${P}/volume`, { method: 'PUT', query: { volume_percent: Math.round(pct), device_id: deviceId } });
export const setShuffle = (state: boolean, deviceId?: string) =>
  api(`${P}/shuffle`, { method: 'PUT', query: { state, device_id: deviceId } });
export const setRepeat = (state: 'off' | 'track' | 'context', deviceId?: string) =>
  api(`${P}/repeat`, { method: 'PUT', query: { state, device_id: deviceId } });
export const addToQueue = (uri: string, deviceId?: string) =>
  api(`${P}/queue`, { method: 'POST', query: { uri, device_id: deviceId } });

export const idFromUri = (uri?: string | null) => uri?.split(':').pop() ?? '';
export const typeFromUri = (uri?: string | null) => uri?.split(':')[1] ?? '';

export type { Episode };
