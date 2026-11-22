import { Music2, Pause, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/format';

export function Cover({
  src,
  alt = '',
  className,
  round,
  icon,
}: {
  src?: string;
  alt?: string;
  className?: string;
  round?: boolean;
  icon?: ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={cx(
        'relative shrink-0 overflow-hidden bg-white/[0.06]',
        round ? 'rounded-full' : 'r-media',
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={cx('size-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')}
        />
      ) : (
        <div className="grid size-full place-items-center text-faint">{icon ?? <Music2 className="size-[40%]" />}</div>
      )}
    </div>
  );
}

type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label: string; size?: 'sm' | 'md' };

export const IconButton = forwardRef<HTMLButtonElement, IconBtnProps>(function IconButton(
  { active, label, size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cx(
        'relative grid shrink-0 place-items-center rounded-full transition-all duration-200 active:scale-90 disabled:pointer-events-none disabled:opacity-30',
        size === 'sm' ? 'size-8' : 'size-9',
        active ? 'text-accent' : 'text-mute hover:text-ink',
        'hover:bg-white/[0.08]',
        className,
      )}
      {...rest}
    >
      {children}
      {active && <span className="glow-dot absolute bottom-0.5 size-1 rounded-full bg-accent" />}
    </button>
  );
});

export function PlayButton({
  playing,
  onClick,
  size = 56,
  className,
}: {
  playing?: boolean;
  onClick: () => void;
  size?: number;
  className?: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={playing ? 'Pause' : 'Abspielen'}
      style={{ width: size, height: size }}
      className={cx(
        'glow grid shrink-0 place-items-center rounded-full bg-accent text-black',
        className,
      )}
    >
      {playing ? (
        <Pause className="size-[40%]" fill="currentColor" strokeWidth={0} />
      ) : (
        <Play className="ml-[6%] size-[40%]" fill="currentColor" strokeWidth={0} />
      )}
    </motion.button>
  );
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'h-8 shrink-0 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors',
        active ? 'border-transparent bg-ink text-black' : 'border-line text-mute hover:border-white/20 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export function Equalizer({ paused, className }: { paused?: boolean; className?: string }) {
  return (
    <div className={cx('eq flex h-3.5 items-end gap-[2px]', paused && 'paused', className)}>
      <span className="h-full" />
      <span className="h-full" />
      <span className="h-full" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-white/[0.06]', className)} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{children}</h2>
      {action}
    </div>
  );
}

export function ArtistLinks({
  artists,
  onOpen,
  className,
}: {
  artists: { id: string; name: string }[];
  onOpen: (id: string) => void;
  className?: string;
}) {
  return (
    <span className={cx('truncate', className)}>
      {artists.map((a, i) => (
        <span key={a.id + i}>
          {i > 0 && ', '}
          <button
            className="hover:text-ink hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              if (a.id) onOpen(a.id);
            }}
          >
            {a.name}
          </button>
        </span>
      ))}
    </span>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="grid place-items-center gap-3 py-24 text-center text-mute">
      <p className="max-w-sm text-sm">Das hat nicht geklappt: {msg}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-ink hover:bg-white/15">
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
