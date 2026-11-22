import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { usePlayer } from '../state/player';
import { useUi } from '../state/ui';
import { LyricsView } from './Lyrics';
import { useContextName } from './NowPlayingPanel';
import { itemArtists, itemImage } from './PlayerBar';
import { ArtistLinks, IconButton } from './ui';

/** Vollbild-Ansicht: großes Cover + synchroner Songtext. */
export function Stage() {
  const { stage, setStage, navigate } = useUi();
  const { item } = usePlayer();
  const ctx = useContextName();

  useEffect(() => {
    if (!stage) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setStage(false);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [stage, setStage]);

  return (
    <AnimatePresence>
      {stage && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 220, damping: 30 }}
          className="absolute inset-x-0 bottom-0 top-[52px] z-30 flex flex-col"
        >
          <div className="absolute inset-0 bg-base/70 backdrop-blur-3xl" />
          <div className="relative flex items-center justify-between px-8 pt-2">
            <IconButton label="Schließen" onClick={() => setStage(false)}>
              <ChevronDown className="size-5" />
            </IconButton>
            <span className="hud">{ctx || 'Aktuelle Wiedergabe'}</span>
            <span className="size-9" />
          </div>
          <div className="relative grid min-h-0 flex-1 grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center gap-[6vw] px-[7vw] pb-32">
            <div className="flex flex-col items-start">
              <AnimatePresence mode="popLayout">
                <motion.img
                  key={item?.id ?? 'none'}
                  src={itemImage(item, 640)}
                  alt=""
                  initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                  className="r-panel aspect-square w-full max-w-[min(520px,52vh)] object-cover shadow-[0_40px_120px_-20px_rgb(0_0_0/0.75)]"
                  draggable={false}
                />
              </AnimatePresence>
              <div className="mt-7 w-full max-w-[520px]">
                <div className="line-clamp-2 text-[clamp(24px,2.6vw,38px)] font-semibold leading-tight tracking-[-0.04em]">{item?.name}</div>
                <div className="mt-1 text-[17px] text-mute">
                  <ArtistLinks
                    artists={itemArtists(item)}
                    onOpen={(id) => {
                      setStage(false);
                      navigate({ name: 'artist', id });
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="h-full min-h-0">
              <LyricsView size="lg" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
