import { BadgeCheck, Heart, Maximize2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { cx, pickImage } from '../lib/format';
import * as sp from '../lib/spotify';
import type { Artist, Track } from '../lib/types';
import { useDesign } from '../state/design';
import { usePlayer } from '../state/player';
import { useUi } from '../state/ui';
import { LyricsView } from './Lyrics';
import { itemArtists, itemImage } from './PlayerBar';
import { ArtistLinks, IconButton } from './ui';

/** Name des Wiedergabe-Kontexts (Playlist, Album, …) */
export function useContextName() {
  const { state } = usePlayer();
  const uri = state?.context?.uri;
  const [name, setName] = useState<string>('');
  useEffect(() => {
    if (!uri) return setName('');
    let stop = false;
    const type = sp.typeFromUri(uri);
    const id = sp.idFromUri(uri);
    const p =
      uri.endsWith(':collection') ? Promise.resolve('Lieblingssongs')
      : type === 'playlist' ? sp.playlist(id).then((x) => x.name)
      : type === 'album' ? sp.album(id).then((x) => x.name)
      : type === 'artist' ? sp.artist(id).then((x) => x.name)
      : Promise.resolve('');
    p.then((n) => !stop && setName(n)).catch(() => !stop && setName(''));
    return () => {
      stop = true;
    };
  }, [uri]);
  return name;
}

export function NowPlayingPanel() {
  const { item, liked, toggleLike } = usePlayer();
  const { navigate, setStage } = useUi();
  const { design } = useDesign();
  const contextName = useContextName();
  const firstArtistId = item?.type === 'track' ? (item as Track).artists[0]?.id : undefined;

  const [artist, setArtist] = useState<Artist | null>(null);
  useEffect(() => {
    if (!firstArtistId) return setArtist(null);
    let stop = false;
    sp.artist(firstArtistId)
      .then((a) => !stop && setArtist(a))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [firstArtistId]);

  return (
    <aside className="r-panel no-scrollbar flex h-full flex-col gap-2 overflow-y-auto">
      {/* Cover-Karte */}
      <div className="glass r-panel relative aspect-[4/5] w-full shrink-0 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={item?.id ?? 'none'}
            src={itemImage(item, 600)}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className={cx('absolute inset-0 size-full object-cover', !item && 'hidden')}
            draggable={false}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/80" />
        <div className="hud absolute inset-x-4 top-4 truncate !text-ink/80">
          {contextName || (item ? 'Aktuelle Wiedergabe' : '')}
        </div>
        <div className="absolute inset-x-4 bottom-4 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={item?.id ?? 'none'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
              >
                <div className="line-clamp-2 text-[22px] font-semibold leading-tight tracking-[-0.03em]">{item?.name ?? 'Betterfy'}</div>
                <div className="truncate text-[13px] text-mute">
                  {item ? (
                    <ArtistLinks artists={itemArtists(item)} onOpen={(id) => navigate({ name: 'artist', id })} />
                  ) : (
                    'Nichts läuft gerade'
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          {item && (
            <IconButton label="Lieblingssong" size="sm" onClick={toggleLike}>
              <Heart className={cx('size-[18px]', liked && 'text-accent')} fill={liked ? 'currentColor' : 'none'} strokeWidth={liked ? 0 : 2} />
            </IconButton>
          )}
        </div>
      </div>

      {/* Songtext */}
      {design.showLyrics && (
      <div className="glass r-panel flex h-[300px] shrink-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="hud flex items-center gap-2"><span className="glow-dot size-1.5 rounded-full bg-accent" />Songtext</span>
          <IconButton label="Songtext groß anzeigen" size="sm" onClick={() => setStage(true)}>
            <Maximize2 className="size-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 px-4">
          <LyricsView size="sm" />
        </div>
      </div>
      )}

      {/* Über den Künstler */}
      {artist && design.showArtist && (
        <button
          onClick={() => navigate({ name: 'artist', id: artist.id })}
          className="glass r-panel group relative aspect-square w-full shrink-0 overflow-hidden text-left"
        >
          <img
            src={pickImage(artist.images, 400)}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85" />
          <div className="hud absolute left-4 top-4 !text-ink/80">Über den Künstler</div>
          <div className="absolute inset-x-4 bottom-4">
            <div className="flex items-center gap-1.5 text-[18px] font-semibold tracking-tight">
              {artist.name}
              <BadgeCheck className="size-4 text-accent" />
            </div>
            {!!artist.genres?.length && <div className="truncate text-[12px] capitalize text-mute">{artist.genres.slice(0, 3).join(' · ')}</div>}
          </div>
        </button>
      )}
    </aside>
  );
}
