import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '../lib/format';
import { fetchLyrics, type Lyrics as LyricsData } from '../lib/lyrics';
import type { Track } from '../lib/types';
import { usePlayer, usePosition } from '../state/player';

export function useLyrics() {
  const { item } = usePlayer();
  const [data, setData] = useState<{ id?: string; lyrics: LyricsData | null; loading: boolean }>({ lyrics: null, loading: false });
  useEffect(() => {
    if (!item || item.type !== 'track') return setData({ lyrics: null, loading: false });
    const t = item as Track;
    let stop = false;
    setData({ id: t.id, lyrics: null, loading: true });
    fetchLyrics({ track: t.name, artist: t.artists[0]?.name ?? '', album: t.album?.name, durationMs: t.duration_ms }).then(
      (lyrics) => !stop && setData({ id: t.id, lyrics, loading: false }),
    );
    return () => {
      stop = true;
    };
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}

export function LyricsView({ size = 'sm', className }: { size?: 'sm' | 'lg'; className?: string }) {
  const { lyrics, loading } = useLyrics();
  const { seek, item } = usePlayer();
  const pos = usePosition(lyrics?.synced ? 12 : 1);
  const box = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const active = useMemo(() => {
    if (!lyrics?.synced) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= pos + 250) idx = i;
      else break;
    }
    return idx;
  }, [lyrics, pos]);

  useEffect(() => {
    const el = lineRefs.current[active];
    const c = box.current;
    if (!el || !c) return;
    c.scrollTo({ top: el.offsetTop - c.clientHeight * (size === 'lg' ? 0.38 : 0.3), behavior: 'smooth' });
  }, [active, size]);

  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
  }, [item?.id]);

  const big = size === 'lg';
  const msg = (text: string) => (
    <div className={cx('grid h-full place-items-center text-center font-semibold text-mute', big ? 'text-2xl' : 'text-sm')}>{text}</div>
  );

  if (!item) return msg('Spiel etwas ab, um den Songtext zu sehen');
  if (loading) return msg('Songtext wird geladen …');
  if (!lyrics) return msg('Für diesen Song gibt es keinen Songtext');
  if (lyrics.instrumental) return msg('♪ Instrumental ♪');

  return (
    <div ref={box} className={cx('fade-y h-full overflow-y-auto scroll-smooth [scrollbar-width:none]', className)}>
      <div className={cx(big ? 'py-[30vh]' : 'py-[45%]', 'space-y-1')}>
        {lyrics.lines.map((l, i) => {
          const past = lyrics.synced && i < active;
          const isActive = i === active;
          return (
            <button
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              disabled={!lyrics.synced}
              onClick={() => lyrics.synced && seek(l.time)}
              className={cx(
                'block w-full origin-left text-left font-bold leading-[1.18] tracking-[-0.03em] transition-all duration-500',
                big ? 'py-2 text-[clamp(28px,3.4vw,48px)]' : 'py-0.5 text-[22px]',
                !lyrics.synced
                  ? 'text-ink/85'
                  : isActive
                    ? 'glow-text text-ink'
                    : past
                      ? 'text-ink/40 hover:text-ink/70'
                      : 'text-ink/25 blur-[0.4px] hover:text-ink/60',
                lyrics.synced && 'cursor-pointer',
              )}
            >
              {l.text || <span className="text-[0.55em] tracking-[0.35em]">• • •</span>}
            </button>
          );
        })}
        <p className={cx('pt-6 text-faint', big ? 'text-sm' : 'text-[11px]')}>Songtext von LRCLIB</p>
      </div>
    </div>
  );
}
