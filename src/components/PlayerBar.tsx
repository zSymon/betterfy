import {
  Heart,
  ListMusic,
  Maximize2,
  MicVocal,
  MonitorSpeaker,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { cx, fmtTime, pickImage } from '../lib/format';
import type { Episode, Track } from '../lib/types';
import { usePlayer, usePosition } from '../state/player';
import { useUi } from '../state/ui';
import { ArtistLinks, Cover, IconButton } from './ui';

export function itemImage(item: Track | Episode | null | undefined, min = 300) {
  if (!item) return undefined;
  return item.type === 'episode' ? pickImage((item as Episode).images ?? (item as Episode).show?.images, min) : pickImage((item as Track).album?.images, min);
}

export function itemArtists(item: Track | Episode | null | undefined) {
  if (!item) return [];
  if (item.type === 'episode') {
    const s = (item as Episode).show;
    return s ? [{ id: '', name: s.name, uri: s.uri }] : [];
  }
  return (item as Track).artists ?? [];
}

export function PlayerBar() {
  const p = usePlayer();
  const { navigate, side, toggleSide, stage, setStage } = useUi();
  const item = p.item;
  const s = p.state;
  const remote = s?.device && s.device.id !== p.sdk.deviceId;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28, delay: 0.2 }}
      className="glass-dark r-bar @container pointer-events-auto relative w-[min(800px,calc(100%-32px))] overflow-hidden px-3 pb-2 pt-2"
    >
      <div className="flex items-center gap-2">
        {/* Steuerung */}
        <div className="flex items-center gap-0.5">
          <IconButton label="Zufallswiedergabe" size="sm" active={s?.shuffle_state} onClick={p.toggleShuffle}>
            <Shuffle className="size-[17px]" />
          </IconButton>
          <IconButton label="Zurück" onClick={p.prev}>
            <SkipBack className="size-[18px]" fill="currentColor" />
          </IconButton>
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={p.toggle}
            aria-label={p.isPlaying ? 'Pause' : 'Abspielen'}
            className="glow mx-1 grid size-11 place-items-center rounded-full bg-accent text-black"
          >
            {p.isPlaying ? (
              <Pause className="size-5" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="ml-0.5 size-5" fill="currentColor" strokeWidth={0} />
            )}
          </motion.button>
          <IconButton label="Weiter" onClick={p.next}>
            <SkipForward className="size-[18px]" fill="currentColor" />
          </IconButton>
          <IconButton
            label={s?.repeat_state === 'track' ? 'Song wiederholen' : 'Wiederholen'}
            size="sm"
            active={s?.repeat_state !== undefined && s.repeat_state !== 'off'}
            onClick={p.cycleRepeat}
          >
            {s?.repeat_state === 'track' ? <Repeat1 className="size-[17px]" /> : <Repeat className="size-[17px]" />}
          </IconButton>
        </div>

        {/* Aktueller Song */}
        <div className="mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-[calc(var(--r)*0.6)] border border-line bg-white/[0.03] p-1.5 pr-2">
          <button onClick={() => setStage(!stage)} className="group relative shrink-0" aria-label="Großansicht">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={item?.id ?? 'none'}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.3 }}
              >
                <Cover src={itemImage(item, 64)} className="size-10" />
              </motion.div>
            </AnimatePresence>
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-[13.5px] font-medium">{item?.name ?? 'Nichts läuft gerade'}</div>
            <div className="truncate text-[12px] text-mute">
              {item ? (
                <ArtistLinks artists={itemArtists(item)} onOpen={(id) => navigate({ name: 'artist', id })} />
              ) : (
                'Wähle einen Song aus'
              )}
            </div>
          </div>
          {item && (
            <IconButton label={p.liked ? 'Aus Lieblingssongs entfernen' : 'Zu Lieblingssongs'} size="sm" onClick={p.toggleLike}>
              <motion.span key={String(p.liked)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
                <Heart
                  className={cx('size-[18px]', p.liked && 'text-accent')}
                  fill={p.liked ? 'currentColor' : 'none'}
                  strokeWidth={p.liked ? 0 : 2}
                />
              </motion.span>
            </IconButton>
          )}
        </div>

        {/* Extras */}
        <div className="flex items-center gap-0.5">
          <IconButton label="Songtext" size="sm" active={stage} onClick={() => setStage(!stage)}>
            <MicVocal className="size-[17px]" />
          </IconButton>
          <IconButton label="Warteschlange" size="sm" active={side === 'queue'} onClick={() => toggleSide('queue')}>
            <ListMusic className="size-[17px]" />
          </IconButton>
          <IconButton
            label={remote ? `Spielt auf ${s?.device.name}` : 'Geräte'}
            size="sm"
            active={side === 'devices' || Boolean(remote)}
            onClick={() => toggleSide('devices')}
          >
            <MonitorSpeaker className="size-[17px]" />
          </IconButton>
          <Volume />
          <IconButton label="Vollbild-Player" size="sm" className="@max-[600px]:hidden" onClick={() => setStage(!stage)}>
            <Maximize2 className="size-[16px]" />
          </IconButton>
        </div>
      </div>

      <Progress />
    </motion.div>
  );
}

function Volume() {
  const { volume, setVolume } = usePlayer();
  const last = useRef(60);
  const Icon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  return (
    <div className="group flex items-center">
      <IconButton
        label={volume === 0 ? 'Ton an' : 'Stumm'}
        size="sm"
        onClick={() => {
          if (volume > 0) {
            last.current = volume;
            setVolume(0);
          } else setVolume(last.current || 50);
        }}
      >
        <Icon className="size-[17px]" />
      </IconButton>
      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        aria-label="Lautstärke"
        onChange={(e) => setVolume(Number(e.target.value))}
        onWheel={(e) => setVolume(Math.max(0, Math.min(100, volume + (e.deltaY < 0 ? 5 : -5))))}
        className="slider w-24 @max-[680px]:hidden"
        style={{ ['--pct' as string]: `${volume}%` }}
      />
    </div>
  );
}

function Progress() {
  const { item, seek } = usePlayer();
  const pos = usePosition(4);
  const dur = item?.duration_ms ?? 0;
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? pos;
  const pct = dur ? Math.min(100, (shown / dur) * 100) : 0;

  return (
    <div className="mt-1 flex items-center gap-3 px-2 font-mono text-[10.5px] tabular-nums text-faint">
      <span className="w-9 text-right">{fmtTime(shown)}</span>
      <input
        type="range"
        min={0}
        max={dur || 1}
        step={1000}
        value={shown}
        disabled={!item}
        aria-label="Position"
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={() => {
          if (drag != null) seek(drag);
          setDrag(null);
        }}
        onKeyUp={() => {
          if (drag != null) seek(drag);
          setDrag(null);
        }}
        className="slider accent flex-1"
        style={{ ['--pct' as string]: `${pct}%` }}
      />
      <span className="w-9">{fmtTime(dur)}</span>
    </div>
  );
}
