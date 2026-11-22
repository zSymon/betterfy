import { Play, Shuffle } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cx } from '../lib/format';
import * as sp from '../lib/spotify';
import { usePlayer } from '../state/player';
import { Cover, IconButton, PlayButton, Skeleton } from './ui';

/** Spotify liefert Beschreibungen mit HTML-Tags/Entities → sicher in reinen Text umwandeln (DOMParser führt nichts aus). */
function plainText(html: string) {
  return new DOMParser().parseFromString(html, 'text/html').documentElement.textContent ?? '';
}

export function CollectionHeader({
  image,
  imageNode,
  kind,
  title,
  meta,
  description,
  round,
}: {
  image?: string;
  imageNode?: ReactNode;
  kind: string;
  title?: string;
  meta?: ReactNode;
  description?: string | null;
  round?: boolean;
}) {
  return (
    <div className="flex items-end gap-7 px-8 pb-7 pt-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        className="shrink-0"
      >
        {imageNode ?? <Cover src={image} round={round} className={cx('size-[clamp(150px,17vw,232px)] shadow-[0_30px_70px_-20px_rgb(0_0_0/0.8)]', !round && 'r-tile')} />}
      </motion.div>
      <div className="min-w-0 pb-1">
        <div className="hud">{kind}</div>
        {title ? (
          <h1 className="mt-3 line-clamp-2 text-[clamp(32px,4.4vw,68px)] font-semibold leading-[1.0] tracking-[-0.05em]">{title}</h1>
        ) : (
          <Skeleton className="mt-3 h-14 w-80" />
        )}
        {description && (
          <p className="mt-3 line-clamp-2 max-w-2xl text-[13.5px] text-mute">{plainText(description)}</p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-x-1.5 text-[13.5px] text-mute">{meta}</div>}
      </div>
    </div>
  );
}

/** Play/Shuffle-Leiste für einen Kontext */
export function ActionBar({ contextUri, children, onPlay }: { contextUri?: string; children?: ReactNode; onPlay?: () => void }) {
  const p = usePlayer();
  const here = Boolean(contextUri) && p.state?.context?.uri === contextUri;
  return (
    <div className="flex items-center gap-4 px-8 pb-5">
      <PlayButton
        playing={here && p.isPlaying}
        onClick={() => (here ? p.toggle() : onPlay ? onPlay() : contextUri && p.playContext(contextUri))}
      />
      {contextUri && (
        <IconButton
          label="Zufällig abspielen"
          active={here && p.state?.shuffle_state}
          onClick={async () => {
            await sp.setShuffle(true).catch(() => {});
            p.playContext(contextUri);
          }}
        >
          <Shuffle className="size-5" />
        </IconButton>
      )}
      {children}
    </div>
  );
}

export function MediaCard({
  image,
  title,
  sub,
  round,
  onOpen,
  onPlay,
}: {
  image?: string;
  title: string;
  sub?: string;
  round?: boolean;
  onOpen: () => void;
  onPlay?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group r-tile w-full p-2.5 text-left transition-colors hover:bg-white/[0.06]"
    >
      <div className="relative">
        <Cover src={image} round={round} className={cx('aspect-square w-full shadow-[0_14px_34px_-14px_rgb(0_0_0/0.7)]', !round && 'r-media')} />
        {onPlay && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            aria-label="Abspielen"
            className="glow absolute bottom-2 right-2 grid size-11 translate-y-2 place-items-center rounded-full bg-accent text-black opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:scale-105"
          >
            <Play className="ml-0.5 size-5" fill="currentColor" strokeWidth={0} />
          </button>
        )}
      </div>
      <div className={cx('mt-2.5 truncate text-[14px] font-medium', round && 'text-center')}>{title}</div>
      {sub && <div className={cx('mt-0.5 line-clamp-2 text-[12.5px] text-mute', round && 'text-center')}>{sub}</div>}
    </div>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-1">{children}</div>;
}

export function Dot() {
  return <span className="text-faint">•</span>;
}
