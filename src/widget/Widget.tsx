// Desktop-Widget: kompakter Player als Kachel im Raster von Widget Notes (2×2, 4×2, 4×4).
import { Ellipsis, Heart, Pause, Play, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePaletteVars } from '../components/Backdrop';
import { itemArtists, itemImage } from '../components/PlayerBar';
import { aura } from '../lib/bridge';
import { cx, fmtTime } from '../lib/format';
import * as sp from '../lib/spotify';
import type { PlaybackState } from '../lib/types';
import { applyDesign, DEFAULT_DESIGN, type Design } from '../state/design';
import type { BridgeState } from '../components/WidgetBridge';


const luminance = (hex: string) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

function useDesignPrefs() {
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  useEffect(() => {
    const load = (prefs: Record<string, unknown> | undefined) => {
      const d = { ...DEFAULT_DESIGN, ...((prefs?.design ?? {}) as Partial<Design>) };
      setDesign(d);
      applyDesign(d);
    };
    aura().getConfig().then((c) => load(c.prefs));
    return aura().on('prefs:changed', load);
  }, []);
  return design;
}

function usePlayback() {
  const [state, setState] = useState<PlaybackState | null>(null);
  const [clock, setClock] = useState({ pos: 0, at: performance.now(), playing: false });
  const hold = useRef(0);
  const bridgeAt = useRef(0);

  const pull = useCallback(async () => {
    try {
      const s = (await sp.playbackState()) ?? null;
      if (performance.now() < hold.current) return;
      setState(s);
      setClock({ pos: s?.progress_ms ?? 0, at: performance.now(), playing: Boolean(s?.is_playing) });
    } catch {
      /* nächster Versuch */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => Date.now() - bridgeAt.current > 2000 && pull(), 1500);
    const i = setInterval(() => Date.now() - bridgeAt.current > 7000 && pull(), 2500);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [pull]);

  const optimistic = (patch: Partial<PlaybackState>) => {
    hold.current = performance.now() + 1500;
    setState((s) => (s ? { ...s, ...patch } : s));
  };
  const soon = () => {
    setTimeout(pull, 350);
    setTimeout(pull, 1300);
  };
  const bridged = () => Date.now() - bridgeAt.current < 7000;
  return { state, setState, clock, setClock, optimistic, soon, bridgeAt, bridged };
}

function usePos(clock: { pos: number; at: number; playing: boolean }, dur: number) {
  const calc = () => Math.min(dur || Infinity, clock.playing ? clock.pos + performance.now() - clock.at : clock.pos);
  const [pos, setPos] = useState(calc);
  useEffect(() => {
    setPos(calc());
    if (!clock.playing) return;
    const t = setInterval(() => setPos(calc()), 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, dur]);
  return pos;
}

export function Widget() {
  const design = useDesignPrefs();
  const [prefs, setPrefs] = useState<WidgetPrefs>({ enabled: true, size: 'medium' });
  const [menu, setMenu] = useState(false);
  const [liked, setLiked] = useState(false);
  const [volume, setVolumeState] = useState<number | null>(null);
  const volTimer = useRef<number | undefined>(undefined);
  const { state, setState, clock, setClock, optimistic, soon, bridgeAt, bridged } = usePlayback();

  const size = prefs.size;
  const style = prefs.style?.mode === 'notes' ? prefs.style : null;
  const item = state?.item ?? null;
  const cover = itemImage(item, size === 'large' ? 300 : 160);
  usePaletteVars(cover, style ? style.accent : design.accent);
  const dur = item?.duration_ms ?? 0;
  const pos = usePos(clock, dur);

  useEffect(
    () =>
      aura().on('player:state', (m: BridgeState) => {
        bridgeAt.current = Date.now();
        setState(m.state);
        setClock({ pos: m.clock.playing ? m.clock.pos + (Date.now() - m.clock.at) : m.clock.pos, at: performance.now(), playing: m.clock.playing });
        setLiked(m.liked);
        if (!volTimer.current) setVolumeState(m.volume);
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    aura().getWidget().then(setPrefs);
    return aura().on('widget:changed', setPrefs);
  }, []);

  useEffect(() => {
    if (state?.device?.volume_percent != null && performance.now() > 0) setVolumeState((v) => (volTimer.current ? v : state.device.volume_percent));
  }, [state?.device?.volume_percent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bridged()) return;
    if (!item?.uri || item.uri.startsWith('spotify:local')) return setLiked(false);
    sp.libraryContains([item.uri]).then(([v]) => setLiked(Boolean(v))).catch(() => {});
  }, [item?.uri]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      /* z.B. kein aktives Gerät */
    }
    soon();
  };

  const relay = (cmd: string, arg?: number) => {
    if (!bridged()) return false;
    aura().sendCommand(cmd, arg);
    return true;
  };

  const toggle = () => {
    if (relay('toggle')) return;
    if (!state) return act(() => sp.play(undefined));
    const playing = !state.is_playing;
    optimistic({ is_playing: playing });
    setClock((c) => ({ pos: c.playing ? c.pos + performance.now() - c.at : c.pos, at: performance.now(), playing }));
    act(() => (playing ? sp.play(undefined) : sp.pause()));
  };
  const like = () => {
    if (!item) return;
    if (relay('like')) return;
    const v = !liked;
    setLiked(v);
    act(() => (v ? sp.librarySave([item.uri]) : sp.libraryRemove([item.uri])));
  };
  const shuffle = () => {
    if (relay('shuffle')) return;
    const v = !state?.shuffle_state;
    optimistic({ shuffle_state: v });
    act(() => sp.setShuffle(v));
  };
  const changeVolume = (v: number) => {
    const next = Math.max(0, Math.min(100, Math.round(v)));
    setVolumeState(next);
    clearTimeout(volTimer.current);
    volTimer.current = window.setTimeout(() => {
      volTimer.current = undefined;
      if (!relay('volume', next)) sp.setVolume(next).catch(() => {});
    }, 120);
  };

  const artists = itemArtists(item).map((a) => a.name).join(', ');
  const pct = dur ? (pos / dur) * 100 : 0;
  const vol = volume ?? 50;

  // ---------- Stil: Betterfy oder wie Widget Notes ----------
  const light = style ? style.stops.reduce((s, c) => s + luminance(c), 0) / style.stops.length > 0.6 : false;
  const tileStyle: CSSProperties = style
    ? ({
        borderRadius: style.radius,
        // Deckkraft wie bei Widget Notes: nur der Hintergrund wird transparent, Inhalt bleibt voll sichtbar
        background: `linear-gradient(135deg, ${style.stops.map((c) => `color-mix(in srgb, ${c} ${Math.round(style.opacity * 100)}%, transparent)`).join(', ')})`,
        '--r': `${style.radius}px`,
        '--color-ink': light ? '#1d1d1f' : '#f5f5f7',
        '--color-mute': light ? 'rgb(29 29 31 / 0.62)' : 'rgb(245 245 247 / 0.62)',
        '--color-faint': light ? 'rgb(29 29 31 / 0.4)' : 'rgb(245 245 247 / 0.4)',
      } as CSSProperties)
    : {};

  // ---------- Bausteine ----------
  const btn = (label: string, onClick: () => void, children: ReactNode, active?: boolean) => (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cx('grid size-8 shrink-0 place-items-center rounded-full transition active:scale-90', active ? 'text-accent' : 'text-mute hover:bg-white/10 hover:text-ink')}
    >
      {children}
    </button>
  );

  const playBtn = (px: number) => (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={toggle}
      aria-label={state?.is_playing ? 'Pause' : 'Abspielen'}
      style={{ width: px, height: px }}
      className="glow grid shrink-0 place-items-center rounded-full bg-accent text-black"
    >
      {state?.is_playing ? (
        <Pause className="size-[42%]" fill="currentColor" strokeWidth={0} />
      ) : (
        <Play className="ml-[6%] size-[42%]" fill="currentColor" strokeWidth={0} />
      )}
    </motion.button>
  );

  const controls = (full: boolean, play = 40) => (
    <div className={cx('flex items-center', full ? 'justify-between' : 'gap-0.5')}>
      {full && btn('Zufall', shuffle, <Shuffle className="size-[15px]" />, state?.shuffle_state)}
      {btn('Zurück', () => relay('prev') || act(() => sp.previous()), <SkipBack className="size-4" fill="currentColor" />)}
      {playBtn(play)}
      {btn('Weiter', () => relay('next') || act(() => sp.next()), <SkipForward className="size-4" fill="currentColor" />)}
      {btn('Lieblingssong', like, <Heart className="size-[15px]" fill={liked ? 'currentColor' : 'none'} strokeWidth={liked ? 0 : 2} />, liked)}
    </div>
  );

  const progress = (times: boolean) => (
    <div className="flex items-center gap-2.5">
      {times && <span className="w-8 text-right font-mono text-[10px] tabular-nums text-faint">{fmtTime(pos)}</span>}
      <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-ink)_16%,transparent)]">
        <div className="glow absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      {times && <span className="w-8 font-mono text-[10px] tabular-nums text-faint">{fmtTime(dur)}</span>}
    </div>
  );

  const VolIcon = vol === 0 ? VolumeX : vol < 50 ? Volume1 : Volume2;
  const volumeRow = (
    <div className="flex items-center gap-2">
      <button onClick={() => changeVolume(vol === 0 ? 50 : 0)} aria-label="Stumm" className="text-mute hover:text-ink">
        <VolIcon className="size-[15px]" />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={vol}
        aria-label="Lautstärke"
        onChange={(e) => changeVolume(Number(e.target.value))}
        className="slider accent h-3 flex-1"
        style={{ ['--pct' as string]: `${vol}%` }}
      />
      <span className="w-7 text-right font-mono text-[10px] tabular-nums text-faint">{vol}</span>
    </div>
  );

  const title = (cls: string, lines = 1) => (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={item?.id ?? 'none'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="min-w-0">
        <div className={cx('font-semibold leading-tight tracking-[-0.02em] text-ink', lines === 1 ? 'truncate' : 'line-clamp-2', cls)}>{item?.name ?? 'Nichts läuft gerade'}</div>
        <div className="mt-0.5 truncate text-[12px] text-mute">{item ? artists : 'Starte Musik in Betterfy'}</div>
      </motion.div>
    </AnimatePresence>
  );

  const art = (cls: string) => (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={cover ?? 'none'}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className={cx('shrink-0 overflow-hidden rounded-[calc(var(--r)*0.45)] bg-white/[0.08] shadow-[0_10px_28px_-10px_rgb(0_0_0/0.6)]', cls)}
      >
        {cover && <img src={cover} alt="" draggable={false} className="size-full object-cover" />}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div
      className="drag group relative h-screen w-screen p-4"
      onWheel={(e) => changeVolume(vol + (e.deltaY < 0 ? 5 : -5))}
    >
      <div
        className={cx(
          'relative h-full w-full overflow-hidden',
          style ? (style.shadow ? 'shadow-[0_8px_24px_-6px_rgb(0_0_0/0.55)]' : '') : 'r-panel border border-white/10 bg-[rgb(8_9_12/0.82)] shadow-[0_8px_24px_-6px_rgb(0_0_0/0.55)]',
        )}
        style={tileStyle}
      >
        {/* Hintergrund */}
        {style ? (
          <>
            {style.gloss && <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.12] to-transparent" />}
          </>
        ) : (
          <>
            {cover && <img src={cover} alt="" className="absolute inset-0 size-full scale-125 object-cover opacity-35 blur-2xl saturate-150" />}
            <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_srgb,var(--glow)_55%,transparent),transparent_70%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </>
        )}

        <div className="relative h-full">
          {size === 'small' && (
            <div className="flex h-full flex-col justify-between p-3">
              {art('size-14')}
              {title('text-[14px]')}
              <div className="-mx-1">{controls(false, 34)}</div>
            </div>
          )}

          {size === 'medium' && (
            <div className="flex h-full gap-3.5 p-3">
              {art('h-full aspect-square')}
              <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                {title('text-[15px]', 2)}
                {progress(false)}
                <div className="-mx-1">{controls(false, 36)}</div>
                {volumeRow}
              </div>
            </div>
          )}

          {size === 'large' && (
            <div className="flex h-full flex-col justify-between p-4">
              <div className="flex gap-4">
                {art('size-[150px]')}
                <div className="flex min-w-0 flex-1 flex-col justify-end pb-1">{title('text-[18px]', 2)}</div>
              </div>
              {progress(true)}
              {controls(true, 46)}
              {volumeRow}
            </div>
          )}
        </div>

        {/* Menü-Knopf (beim Hovern) */}
        <button
          onClick={() => setMenu(true)}
          aria-label="Widget-Menü"
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/40 text-white/70 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
        >
          <Ellipsis className="size-4" />
        </button>

        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-10 flex flex-wrap content-center items-center justify-center gap-2 bg-[rgb(8_9_12/0.92)] p-3 text-white"
            >
              {(
                [
                  ['small', 'Klein'],
                  ['medium', 'Mittel'],
                  ['large', 'Groß'],
                ] as const
              ).map(([id, label]) => (
                <MenuBtn
                  key={id}
                  active={size === id}
                  onClick={() => {
                    setMenu(false);
                    aura().setWidget({ size: id });
                  }}
                >
                  {label}
                </MenuBtn>
              ))}
              <MenuBtn
                onClick={() => {
                  setMenu(false);
                  aura().showMain();
                }}
              >
                Betterfy öffnen
              </MenuBtn>
              <MenuBtn onClick={() => aura().setWidget({ enabled: false })}>Ausblenden</MenuBtn>
              <button onClick={() => setMenu(false)} aria-label="Schließen" className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-white/60 hover:text-white">
                <X className="size-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MenuBtn({ children, onClick, active }: { children: ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'h-8 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors',
        active ? 'border-transparent bg-accent text-black' : 'border-white/15 text-white hover:border-white/30',
      )}
    >
      {children}
    </button>
  );
}
