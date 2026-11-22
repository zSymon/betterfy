import { Clock3, Disc3, Ellipsis, Heart, ListPlus, Play, UserRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useCallback, useRef, useState } from 'react';
import { cx, fmtDate, fmtTime } from '../lib/format';
import { useClickOutside } from '../lib/hooks';
import * as sp from '../lib/spotify';
import type { Playable } from '../lib/types';
import { usePlayer } from '../state/player';
import { useUi } from '../state/ui';
import { ArtistLinks, Cover, Equalizer } from './ui';

type Props = {
  tracks: Playable[];
  /** Kontext für die Wiedergabe (Playlist/Album/Lieblingssongs) */
  contextUri?: string;
  showAlbum?: boolean;
  showAdded?: boolean;
  showCover?: boolean;
  /** Album-Ansicht: Tracknummer statt Index */
  trackNumbers?: number[];
  likedView?: boolean;
};

export function TrackTable({ tracks, contextUri, showAlbum = true, showAdded = false, showCover = true, trackNumbers, likedView }: Props) {
  const { item, isPlaying, playContext, playUris } = usePlayer();
  const cols = cx(
    'grid items-center gap-4 px-3',
    showAlbum && showAdded
      ? 'grid-cols-[28px_minmax(0,5fr)_minmax(0,3fr)_minmax(0,1.6fr)_96px]'
      : showAlbum || showAdded
        ? 'grid-cols-[28px_minmax(0,5fr)_minmax(0,3fr)_96px]'
        : 'grid-cols-[28px_minmax(0,1fr)_96px]',
  );

  const play = useCallback(
    (t: Playable) => {
      if (t.isLocal) return;
      if (contextUri) playContext(contextUri, t.uri);
      else playUris(tracks.filter((x) => !x.isLocal).map((x) => x.uri), t.uri);
    },
    [contextUri, tracks, playContext, playUris],
  );

  return (
    <div role="table" className="text-[13.5px]">
      <div className={cx(cols, 'hud h-9 border-b border-line !text-[10px]')}>
        <span className="text-right">#</span>
        <span>Titel</span>
        {showAlbum && <span>Album</span>}
        {showAdded && <span>Hinzugefügt</span>}
        <span className="flex justify-end pr-8">
          <Clock3 className="size-4" />
        </span>
      </div>
      <div className="pt-2">
        {tracks.map((t, i) => (
          <Row
            key={`${t.uri}-${i}`}
            t={t}
            n={trackNumbers?.[i] ?? i + 1}
            cols={cols}
            showAlbum={showAlbum}
            showAdded={showAdded}
            showCover={showCover}
            current={item?.uri === t.uri || (!!item?.id && item.id === t.id)}
            playing={isPlaying}
            onPlay={play}
            liked={likedView}
          />
        ))}
      </div>
    </div>
  );
}

const Row = memo(function Row({
  t,
  n,
  cols,
  showAlbum,
  showAdded,
  showCover,
  current,
  playing,
  onPlay,
  liked,
}: {
  t: Playable;
  n: number;
  cols: string;
  showAlbum: boolean;
  showAdded: boolean;
  showCover: boolean;
  current: boolean;
  playing: boolean;
  onPlay: (t: Playable) => void;
  liked?: boolean;
}) {
  const { navigate } = useUi();
  return (
    <div
      role="row"
      onDoubleClick={() => onPlay(t)}
      className={cx(
        cols,
        'row-cv group h-[var(--row)] rounded-[calc(var(--r)*0.5)] transition-colors',
        current ? 'bg-accent/[0.08] ring-1 ring-inset ring-accent/20' : 'hover:bg-white/[0.05]',
        t.isLocal && 'opacity-50',
      )}
    >
      <div className="flex justify-end font-mono text-[12px] text-faint tabular-nums">
        {current ? (
          <>
            <span className="group-hover:hidden">
              <Equalizer paused={!playing} />
            </span>
            <button className="hidden text-ink group-hover:block" onClick={() => onPlay(t)} aria-label="Abspielen">
              <Play className="size-4" fill="currentColor" strokeWidth={0} />
            </button>
          </>
        ) : (
          <>
            <span className="group-hover:hidden">{n}</span>
            <button className="hidden text-ink group-hover:block" onClick={() => onPlay(t)} aria-label="Abspielen">
              <Play className="size-4" fill="currentColor" strokeWidth={0} />
            </button>
          </>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        {showCover && <Cover src={t.image} className="size-[calc(var(--row)-16px)]" />}
        <div className="min-w-0">
          <div className={cx('truncate font-medium', current ? 'glow-text text-accent' : 'text-ink')}>{t.name}</div>
          <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-mute">
            {t.explicit && (
              <span className="grid h-3.5 shrink-0 place-items-center rounded-[3px] bg-white/25 px-1 text-[9px] font-bold text-black">
                E
              </span>
            )}
            <ArtistLinks artists={t.artists} onOpen={(id) => navigate({ name: 'artist', id })} />
          </div>
        </div>
      </div>

      {showAlbum && (
        <div className="truncate text-mute">
          {t.album && (
            <button className="truncate hover:text-ink hover:underline" onClick={() => navigate({ name: 'album', id: t.album!.id })}>
              {t.album.name}
            </button>
          )}
        </div>
      )}
      {showAdded && <div className="truncate text-mute">{fmtDate(t.addedAt)}</div>}

      <div className="flex items-center justify-end gap-1 text-mute tabular-nums">
        {liked && <Heart className="mr-1 size-4 text-accent" fill="currentColor" strokeWidth={0} />}
        <span className="font-mono text-[12px]">{fmtTime(t.durationMs)}</span>
        <RowMenu t={t} />
      </div>
    </div>
  );
});

function RowMenu({ t }: { t: Playable }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { enqueue } = usePlayer();
  const { navigate, toast } = useUi();
  useClickOutside(ref, () => setOpen(false), open);

  const items = [
    { icon: ListPlus, label: 'Zur Warteschlange', run: () => enqueue(t.uri) },
    {
      icon: Heart,
      label: 'Zu Lieblingssongs',
      run: () =>
        sp
          .librarySave([t.uri])
          .then(() => toast('Zu deinen Lieblingssongs hinzugefügt'))
          .catch(() => toast('Hat nicht geklappt', 'error')),
    },
    ...(t.artists[0]?.id ? [{ icon: UserRound, label: 'Zum Künstler', run: () => navigate({ name: 'artist', id: t.artists[0].id }) }] : []),
    ...(t.album ? [{ icon: Disc3, label: 'Zum Album', run: () => navigate({ name: 'album', id: t.album!.id }) }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cx('grid size-8 place-items-center rounded-full hover:bg-white/10 hover:text-ink', open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
        aria-label="Mehr"
      >
        <Ellipsis className="size-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.14 }}
            className="glass-dark absolute right-0 top-9 z-30 w-52 origin-top-right rounded-xl p-1.5"
          >
            {items.map(({ icon: Icon, label, run }) => (
              <button
                key={label}
                onClick={() => {
                  setOpen(false);
                  run();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-ink hover:bg-white/10"
              >
                <Icon className="size-4 text-mute" />
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
