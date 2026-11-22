import { PRESETS } from '../state/design';
// Nur für die Entwicklung: simuliert Login + Spotify-API mit Beispieldaten (aktiv mit ?mock in der URL).
const cover = (h1: number, h2: number, label = '') =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 70% 55%)"/><stop offset="1" stop-color="hsl(${h2} 60% 22%)"/></linearGradient></defs><rect width="640" height="640" fill="url(#g)"/><circle cx="460" cy="190" r="120" fill="hsl(${h1} 90% 80% / .35)"/><text x="40" y="590" font-family="Inter,Arial" font-weight="800" font-size="64" fill="white" opacity=".85">${label}</text></svg>`,
  );

const img = (h1: number, h2: number, label = '') => [{ url: cover(h1, h2, label), width: 640, height: 640 }];

const artists = ['Mira Vale', 'Northwind', 'Lumen Park', 'Juno Hart', 'The Quiet Hours', 'Sol Arcade'].map((name, i) => ({
  id: `ar${i}`,
  name,
  uri: `spotify:artist:ar${i}`,
  images: img(120 + i * 40, 200 + i * 30),
  genres: ['indie pop', 'dream pop', 'alt r&b'],
  type: 'artist',
}));

const albums = Array.from({ length: 8 }, (_, i) => ({
  id: `al${i}`,
  name: ['Glasshouse', 'Afterglow', 'Low Tide', 'Paper Moons', 'Velvet Static', 'Neon Fields', 'Slow Bloom', 'Northern Lights'][i],
  uri: `spotify:album:al${i}`,
  images: img(110 + i * 25, 160 + i * 20, ''),
  artists: [artists[i % artists.length]],
  album_type: i % 3 ? 'album' : 'single',
  release_date: `202${i % 6}-05-01`,
  total_tracks: 10,
}));

const titles = ['Hold Me Close', 'Golden Hour Drive', 'Satellites', 'Soft Static', 'Ocean Eyes Again', 'Paper Planes', 'Midnight Garden', 'Lowlight', 'Weightless', 'Echoes in Blue', 'Summer Rain', 'Glow', 'Afterparty', 'Tidal'];
const tracks = titles.map((name, i) => ({
  id: `t${i}`,
  name,
  uri: `spotify:track:t${i}`,
  type: 'track',
  duration_ms: 150_000 + i * 13_000,
  explicit: i % 4 === 0,
  track_number: i + 1,
  artists: [artists[i % artists.length]],
  album: albums[i % albums.length],
}));

const me = { id: 'me', display_name: 'Alex', uri: 'spotify:user:me', images: img(140, 260) };
const playlists = ['Late Night Drive', 'Focus Flow', 'Sunday Morning', 'Gym Energy', 'Indie Discoveries', 'Chill Vibes', 'Roadtrip 2026'].map((name, i) => ({
  id: `pl${i}`,
  name,
  uri: `spotify:playlist:pl${i}`,
  description: 'Handverlesen für dich',
  images: img(100 + i * 35, 180 + i * 25),
  owner: i < 4 ? { id: 'me', display_name: 'Alex' } : { id: 'x', display_name: 'Spotify' },
  items: { total: 20 + i * 7 },
  public: true,
}));

const page = <T,>(items: T[], total = items.length) => ({ items, total, limit: 50, offset: 0, next: null });

const startedAt = Date.now() - 52_000;
const playback = () => ({
  device: { id: 'aura', name: 'Betterfy', type: 'Computer', is_active: true, is_restricted: false, volume_percent: 64 },
  repeat_state: 'off',
  shuffle_state: true,
  context: { type: 'playlist', uri: 'spotify:playlist:pl0' },
  timestamp: Date.now(),
  progress_ms: (Date.now() - startedAt) % tracks[0].duration_ms,
  is_playing: true,
  item: tracks[0],
  currently_playing_type: 'track',
});

function route(url: URL): unknown {
  const p = url.pathname.replace('/v1', '');
  if (p === '/me') return me;
  if (p === '/me/playlists') return page(playlists);
  if (p === '/me/tracks') return page(tracks.map((track, i) => ({ added_at: new Date(Date.now() - i * 86_400_000 * 3).toISOString(), track })), 248);
  if (p === '/me/albums') return page(albums.slice(0, 3).map((album) => ({ added_at: '', album })));
  if (p === '/me/following') return { artists: { items: artists.slice(0, 4), next: null } };
  if (p === '/me/player') return playback();
  if (p === '/me/player/devices') return { devices: [playback().device, { id: 'phone', name: 'Pixel 9', type: 'Smartphone', is_active: false, is_restricted: false, volume_percent: 50 }] };
  if (p === '/me/player/queue') return { currently_playing: tracks[0], queue: tracks.slice(1) };
  if (p === '/me/player/recently-played') return { items: playlists.slice(0, 6).map((pl) => ({ track: tracks[0], context: { uri: pl.uri, type: 'playlist' }, played_at: '' })), next: null };
  if (p === '/me/top/artists') return page(artists);
  if (p === '/me/top/tracks') return page(tracks);
  if (p === '/me/library/contains') return [true];
  if (p.startsWith('/playlists/') && p.endsWith('/items')) return page(tracks.map((item, i) => ({ added_at: new Date(Date.now() - i * 86_400_000 * 9).toISOString(), item })));
  if (p.startsWith('/playlists/')) return playlists.find((x) => p.endsWith(x.id)) ?? playlists[0];
  if (p.startsWith('/albums/')) {
    const a = albums.find((x) => p.endsWith(x.id)) ?? albums[0];
    return { ...a, tracks: page(tracks.slice(0, 10).map(({ album: _a, ...t }) => t)), copyrights: [{ text: '℗ 2024 Beispiel Records' }] };
  }
  if (p.startsWith('/artists/') && p.endsWith('/albums')) return page(albums);
  if (p.startsWith('/artists/')) return artists.find((x) => p.endsWith(x.id)) ?? artists[0];
  if (p === '/search') return { tracks: page(tracks.slice(0, 10)), artists: page(artists), albums: page(albums), playlists: page(playlists) };
  return {};
}

/** ?update zeigt ein verfügbares Update (für Layout-Tests). */
function mockUpdate(): UpdateStatus {
  const has = new URLSearchParams(location.search).has('update');
  return has
    ? {
        state: 'available',
        current: '0.1.0',
        canInstall: true,
        latest: { version: '0.2.0', url: '', size: 1, page: '', notes: '### Neu\n- **Medientasten** – Play/Pause, Vor und Zurück auf der Tastatur\n- **Update-Knopf** direkt in Betterfy' },
      }
    : { state: 'none', current: '0.1.0', canInstall: true, checkedAt: Date.now() };
}

export function installMock() {
  (window as unknown as { __auraMock: Window['aura'] }).__auraMock = {
    platform: 'win32',
    login: async () => true,
    cancelLogin: async () => {},
    getToken: async () => 'mock',
    logout: async () => true,
    getConfig: async () => ({ clientId: 'mock', redirectUri: 'http://127.0.0.1:8888/callback', loggedIn: !location.search.includes('loggedout'), prefs: { design: PRESETS.find((p) => p.id === new URLSearchParams(location.search).get('preset'))?.design ?? {} } }),
    savePrefs: async () => true,
    openExternal: async () => {},
    showMain: async () => {},
    getWidget: async () => ({ enabled: true, size: (new URLSearchParams(location.search).get('wsize') as WidgetPrefs['size']) || 'medium', style: new URLSearchParams(location.search).has('notes') ? { mode: 'notes', stops: ['#0F0F11', '#33333A'], accent: '#FFD60A', opacity: 0.7, radius: 40, gloss: true, shadow: true } : { mode: 'betterfy' } }),
    setWidget: async (p) => ({ enabled: true, size: 'medium', ...p }),
    notesStyles: async () => [
      { stops: ['#0F0F11', '#33333A'], accent: '#FFD60A', opacity: 0.7, radius: 40, gloss: true, shadow: true, title: 'ToDo' },
      { stops: ['#2A3B68', '#0D1427'], accent: '#64D2FF', opacity: 1, radius: 22, gloss: true, shadow: true, title: 'Ideen' },
    ],
    sendPlayerState: () => {},
    sendCommand: () => {},
    setMediaKeys: () => {},
    getUpdate: async () => mockUpdate(),
    checkUpdate: async () => mockUpdate(),
    installUpdate: async () => ({ ...mockUpdate(), state: 'downloading', progress: 42 }),
    on: () => () => {},
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === 'api.spotify.com') {
      const method = init?.method ?? 'GET';
      if (method !== 'GET') return new Response(null, { status: 204 });
      return new Response(JSON.stringify(route(url)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.hostname === 'lrclib.net') {
      const lines = ['Hold me close', "Look me dead in my eyes", 'Dead in my', 'Till the day that I die', '', 'Every light in the city', 'Burns a little for you', "And I don't know why", 'But I want to stay', 'Hold me close'];
      const synced = lines.map((l, i) => `[00:${String(40 + i * 4).padStart(2, '0')}.00] ${l}`).join('\n');
      return new Response(JSON.stringify({ syncedLyrics: synced }), { status: 200 });
    }
    return realFetch(input, init);
  };
}
