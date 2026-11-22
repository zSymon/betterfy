import { aura } from '../lib/bridge';
// Player-State: verbindet das Web Playback SDK (Betterfy als eigenes Gerät) mit Spotify Connect (andere Geräte).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as sp from '../lib/spotify';
import type { Device, Episode, PlaybackState, Track } from '../lib/types';
import { useUi } from './ui';

type SdkStatus = 'loading' | 'ready' | 'error';

type PlayerCtx = {
  state: PlaybackState | null;
  item: Track | Episode | null;
  isPlaying: boolean;
  /** Zeitpunkt + Position der letzten bekannten Position (für flüssige Interpolation) */
  clock: { pos: number; at: number; playing: boolean };
  liked: boolean;
  volume: number;
  sdk: { status: SdkStatus; deviceId: string | null; error?: string };
  devices: Device[];
  refreshDevices(): Promise<void>;
  playContext(contextUri: string, offsetUri?: string): Promise<void>;
  playUris(uris: string[], offsetUri?: string): Promise<void>;
  toggle(): Promise<void>;
  next(): Promise<void>;
  prev(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(pct: number): void;
  toggleShuffle(): Promise<void>;
  cycleRepeat(): Promise<void>;
  transfer(deviceId: string): Promise<void>;
  enqueue(uri: string): Promise<void>;
  toggleLike(): Promise<void>;
  refresh(): void;
};

const Ctx = createContext<PlayerCtx | null>(null);

function loadSdkScript() {
  if (document.getElementById('spotify-sdk')) return;
  const s = document.createElement('script');
  s.id = 'spotify-sdk';
  s.src = 'https://sdk.scdn.co/spotify-player.js';
  s.async = true;
  document.body.appendChild(s);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { toast, setSide, setHelp } = useUi();
  const [state, setState] = useState<PlaybackState | null>(null);
  const [clock, setClock] = useState({ pos: 0, at: performance.now(), playing: false });
  const [liked, setLiked] = useState(false);
  const [volume, setVolumeState] = useState(60);
  const [sdk, setSdk] = useState<PlayerCtx['sdk']>({ status: 'loading', deviceId: null });
  const [devices, setDevices] = useState<Device[]>([]);

  const playerRef = useRef<Spotify.Player | null>(null);
  const sdkIdRef = useRef<string | null>(null);
  const stateRef = useRef<PlaybackState | null>(null);
  const busyUntil = useRef(0); // optimistische Updates nicht sofort durch Polling überschreiben
  const volTimer = useRef<number | undefined>(undefined);
  /** Zuletzt vom SDK gemeldeter Song – gewinnt kurzzeitig gegen veraltete API-Antworten */
  const sdkTrack = useRef<{ item: Track; at: number } | null>(null);
  stateRef.current = state;

  // ---------- Status vom Server holen ----------
  const pull = useCallback(async () => {
    try {
      let s = (await sp.playbackState()) ?? null;
      if (performance.now() < busyUntil.current) return;
      const fresh = sdkTrack.current;
      if (s && fresh && performance.now() - fresh.at < 6000 && s.item?.uri !== fresh.item.uri && s.device?.id === sdkIdRef.current)
        s = { ...s, item: fresh.item };
      setState(s);
      if (s) {
        setClock({ pos: s.progress_ms ?? 0, at: performance.now(), playing: s.is_playing });
        if (s.device?.volume_percent != null) setVolumeState(s.device.volume_percent);
      } else setClock((c) => ({ ...c, playing: false }));
    } catch (e) {
      if (e instanceof sp.AuthRequired) return;
      // Netzwerkfehler still ignorieren; nächster Poll versucht es erneut.
    }
  }, []);

  const refreshSoon = useCallback(() => {
    setTimeout(pull, 300);
    setTimeout(pull, 1200);
  }, [pull]);

  useEffect(() => {
    pull();
    let t: number;
    const loop = () => {
      const local = stateRef.current?.device?.id && stateRef.current.device.id === sdkIdRef.current;
      // Lokal: SDK liefert Events, Polling seltener. Remote: öfter.
      const delay = document.hidden ? 10_000 : local ? 5000 : 2000;
      t = window.setTimeout(async () => {
        await pull();
        loop();
      }, delay);
    };
    loop();
    return () => clearTimeout(t);
  }, [pull]);

  // ---------- Web Playback SDK ----------
  useEffect(() => {
    let disposed = false;
    const fail = (msg: string) => !disposed && setSdk({ status: 'error', deviceId: null, error: msg });
    const timeout = setTimeout(() => {
      if (!sdkIdRef.current) fail('Der Spotify-Player konnte nicht gestartet werden.');
    }, 20_000);

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (disposed) return;
      const player = new window.Spotify.Player({
        name: 'Betterfy',
        volume: 0.6,
        getOAuthToken: (cb) => {
          aura().getToken().then((t) => t && cb(t));
        },
      });
      playerRef.current = player;

      player.addListener('ready', async ({ device_id }) => {
        sdkIdRef.current = device_id;
        clearTimeout(timeout);
        setSdk({ status: 'ready', deviceId: device_id });
        // Wenn gerade nirgends etwas läuft: Betterfy zum aktiven Gerät machen (ohne loszuspielen)
        try {
          const current = await sp.playbackState();
          if (!current?.device?.is_active) await sp.transfer(device_id, false);
        } catch {
          /* egal */
        }
        refreshSoon();
      });
      player.addListener('not_ready', () => {
        sdkIdRef.current = null;
        setSdk((s) => ({ ...s, status: 'loading', deviceId: null }));
      });
      player.addListener('player_state_changed', (s) => {
        if (!s) return;
        setClock({ pos: s.position, at: performance.now(), playing: !s.paused });
        const t = s.track_window.current_track;
        const changed = Boolean(t) && t.uri !== stateRef.current?.item?.uri;
        // Neuen Song sofort aus dem SDK übernehmen – die Web API hinkt beim Wechsel oft 1–2 s hinterher
        const sdkItem: Track | null = t
          ? {
              id: t.id ?? sp.idFromUri(t.uri),
              name: t.name,
              uri: t.uri,
              type: 'track',
              duration_ms: t.duration_ms,
              artists: t.artists.map((a) => ({ id: sp.idFromUri(a.uri), name: a.name, uri: a.uri })),
              album: { id: sp.idFromUri(t.album.uri), name: t.album.name, uri: t.album.uri, images: t.album.images, artists: [] },
            }
          : null;
        if (changed && sdkItem) sdkTrack.current = { item: { ...sdkItem, album: { ...sdkItem.album, artists: sdkItem.artists } }, at: performance.now() };
        setState((prev) =>
          prev
            ? { ...prev, is_playing: !s.paused, progress_ms: s.position, ...(changed && sdkItem ? { item: { ...sdkItem, album: { ...sdkItem.album, artists: sdkItem.artists } } } : {}) }
            : prev,
        );
        if (changed) refreshSoon();
      });
      const onErr = (label: string) => ({ message }: Spotify.Error) => {
        console.warn(`[sdk] ${label}:`, message);
        fail(
          label === 'account'
            ? 'Für die Wiedergabe in Betterfy wird Spotify Premium benötigt.'
            : label === 'init'
              ? 'In-App-Wiedergabe wird nicht unterstützt (Widevine fehlt).'
              : `Spotify-Player: ${message}`,
        );
      };
      player.addListener('initialization_error', onErr('init'));
      player.addListener('authentication_error', onErr('auth'));
      player.addListener('account_error', onErr('account'));
      // Wiederholte Playback-Fehler = DRM-Lizenz abgelehnt (Spotify spielt nur die unverschlüsselten ersten ~10 s).
      let errTimes: number[] = [];
      let warned = false;
      player.addListener('playback_error', ({ message }) => {
        console.warn('[sdk] playback:', message);
        const now = Date.now();
        errTimes = [...errTimes.filter((t) => now - t < 20_000), now];
        if (errTimes.length >= 2 && !warned) {
          warned = true;
          player.pause().catch(() => {});
          setSdk((s) => ({ ...s, status: 'error', error: 'Spotify gibt die Songs für diese Betterfy-Version nicht frei (Kopierschutz).' }));
          setHelp(true);
        }
      });
      player.connect().then((ok) => !ok && fail('Verbindung zum Spotify-Player fehlgeschlagen.'));
    };

    if (window.Spotify) window.onSpotifyWebPlaybackSDKReady();
    else loadSdkScript();

    return () => {
      disposed = true;
      clearTimeout(timeout);
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [refreshSoon]);

  // ---------- Like-Status des aktuellen Songs ----------
  const itemUri = state?.item?.uri;
  useEffect(() => {
    if (!itemUri || itemUri.startsWith('spotify:local')) return setLiked(false);
    let stop = false;
    sp.libraryContains([itemUri])
      .then(([v]) => !stop && setLiked(Boolean(v)))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [itemUri]);

  // ---------- Aktionen ----------
  const refreshDevices = useCallback(async () => {
    try {
      setDevices((await sp.devices()).devices);
    } catch {
      /* egal */
    }
  }, []);

  /** Ziel-Gerät: aktives Gerät, sonst Betterfy, sonst Geräteauswahl öffnen. */
  const target = useCallback(async (): Promise<string | undefined | null> => {
    const s = stateRef.current;
    if (s?.device?.is_active && s.device.id) return s.device.id;
    if (sdkIdRef.current) return sdkIdRef.current;
    const list = (await sp.devices()).devices;
    setDevices(list);
    const active = list.find((d) => d.is_active) ?? (list.length === 1 ? list[0] : undefined);
    if (active?.id) return active.id;
    setSide('devices');
    toast('Kein Wiedergabegerät gefunden. Wähle ein Gerät aus oder öffne Spotify auf einem anderen Gerät.', 'error');
    return null;
  }, [setSide, toast]);

  const run = useCallback(
    async (fn: (deviceId?: string) => Promise<unknown>, needsDevice = true) => {
      try {
        let deviceId: string | undefined;
        if (needsDevice) {
          const t = await target();
          if (t === null) return;
          deviceId = t;
        }
        await fn(deviceId);
      } catch (e) {
        if (e instanceof sp.ApiError) {
          if (e.status === 404) {
            setSide('devices');
            toast('Kein aktives Gerät. Wähle eins aus.', 'error');
          } else if (e.status === 403) toast('Diese Aktion ist gerade nicht möglich.', 'error');
          else toast(`Spotify: ${e.message}`, 'error');
        }
      } finally {
        refreshSoon();
      }
    },
    [target, toast, setSide, refreshSoon],
  );

  const optimistic = (patch: Partial<PlaybackState>) => {
    busyUntil.current = performance.now() + 900;
    setState((s) => (s ? { ...s, ...patch } : s));
  };

  const localPlayer = () => (stateRef.current?.device?.id && stateRef.current.device.id === sdkIdRef.current ? playerRef.current : null);

  const playContext = useCallback(
    (contextUri: string, offsetUri?: string) => {
      playerRef.current?.activateElement?.();
      return run((d) => sp.play({ context_uri: contextUri, ...(offsetUri ? { offset: { uri: offsetUri } } : {}) }, d));
    },
    [run],
  );

  const playUris = useCallback(
    (uris: string[], offsetUri?: string) => {
      playerRef.current?.activateElement?.();
      return run((d) => sp.play({ uris: uris.slice(0, 500), ...(offsetUri ? { offset: { uri: offsetUri } } : {}) }, d));
    },
    [run],
  );

  const toggle = useCallback(async () => {
    const s = stateRef.current;
    playerRef.current?.activateElement?.();
    const lp = localPlayer();
    if (s) {
      const playing = !s.is_playing;
      optimistic({ is_playing: playing });
      setClock((c) => {
        const pos = c.playing ? c.pos + (performance.now() - c.at) : c.pos;
        return { pos, at: performance.now(), playing };
      });
      if (lp) return void lp.togglePlay();
      return run((d) => (playing ? sp.play(undefined, d) : sp.pause(d)), false);
    }
    return run((d) => sp.play(undefined, d));
  }, [run]);

  const next = useCallback(async () => {
    const lp = localPlayer();
    if (lp) return void lp.nextTrack().then(refreshSoon);
    return run((d) => sp.next(d), false);
  }, [run, refreshSoon]);

  const prev = useCallback(async () => {
    const lp = localPlayer();
    if (lp) return void lp.previousTrack().then(refreshSoon);
    return run((d) => sp.previous(d), false);
  }, [run, refreshSoon]);

  const seek = useCallback(
    async (ms: number) => {
      busyUntil.current = performance.now() + 900;
      setClock((c) => ({ ...c, pos: ms, at: performance.now() }));
      const lp = localPlayer();
      if (lp) return void lp.seek(ms);
      return run((d) => sp.seek(ms, d), false);
    },
    [run],
  );

  const setVolume = useCallback((pct: number) => {
    setVolumeState(pct);
    busyUntil.current = performance.now() + 900;
    const lp = localPlayer();
    if (lp) return void lp.setVolume(pct / 100);
    clearTimeout(volTimer.current);
    volTimer.current = window.setTimeout(() => sp.setVolume(pct).catch(() => {}), 180);
  }, []);

  const toggleShuffle = useCallback(async () => {
    const v = !stateRef.current?.shuffle_state;
    optimistic({ shuffle_state: v });
    return run(() => sp.setShuffle(v), false);
  }, [run]);

  const cycleRepeat = useCallback(async () => {
    const order = ['off', 'context', 'track'] as const;
    const cur = stateRef.current?.repeat_state ?? 'off';
    const v = order[(order.indexOf(cur) + 1) % 3];
    optimistic({ repeat_state: v });
    return run(() => sp.setRepeat(v), false);
  }, [run]);

  const transfer = useCallback(
    async (deviceId: string) => {
      playerRef.current?.activateElement?.();
      await run(() => sp.transfer(deviceId, true), false);
      setTimeout(refreshDevices, 800);
    },
    [run, refreshDevices],
  );

  const enqueue = useCallback(
    async (uri: string) => {
      await run((d) => sp.addToQueue(uri, d));
      toast('Zur Warteschlange hinzugefügt');
    },
    [run, toast],
  );

  const toggleLike = useCallback(async () => {
    const uri = stateRef.current?.item?.uri;
    if (!uri) return;
    const v = !liked;
    setLiked(v);
    try {
      await (v ? sp.librarySave([uri]) : sp.libraryRemove([uri]));
      toast(v ? 'Zu deinen Lieblingssongs hinzugefügt' : 'Aus deinen Lieblingssongs entfernt');
    } catch {
      setLiked(!v);
      toast('Konnte Lieblingssongs nicht ändern', 'error');
    }
  }, [liked, toast]);

  const value = useMemo<PlayerCtx>(
    () => ({
      state,
      item: state?.item ?? null,
      isPlaying: Boolean(state?.is_playing),
      clock,
      liked,
      volume,
      sdk,
      devices,
      refreshDevices,
      playContext,
      playUris,
      toggle,
      next,
      prev,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      transfer,
      enqueue,
      toggleLike,
      refresh: refreshSoon,
    }),
    [state, clock, liked, volume, sdk, devices, refreshDevices, playContext, playUris, toggle, next, prev, seek, setVolume, toggleShuffle, cycleRepeat, transfer, enqueue, toggleLike, refreshSoon],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error('PlayerProvider fehlt');
  return c;
}

/** Aktuelle Wiedergabeposition, flüssig interpoliert. */
export function usePosition(fps = 4) {
  const { clock, item } = usePlayer();
  const dur = item?.duration_ms ?? 0;
  const calc = () => Math.min(dur || Infinity, clock.playing ? clock.pos + (performance.now() - clock.at) : clock.pos);
  const [pos, setPos] = useState(calc);
  useEffect(() => {
    setPos(calc());
    if (!clock.playing) return;
    const id = setInterval(() => setPos(calc()), 1000 / fps);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, dur, fps]);
  return pos;
}
