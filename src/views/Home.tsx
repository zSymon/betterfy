import { Play } from 'lucide-react';
import { motion } from 'motion/react';
import { CardGrid, MediaCard } from '../components/Collection';
import { Cover, Equalizer, SectionTitle, Skeleton } from '../components/ui';
import { greeting, pickImage } from '../lib/format';
import { useAsync } from '../lib/hooks';
import * as sp from '../lib/spotify';
import { usePlayer } from '../state/player';
import { useUi, type Route } from '../state/ui';

type Tile = { uri: string; name: string; image?: string; route: Route };

async function resolveContext(uri: string, userId: string): Promise<Tile | null> {
  const type = sp.typeFromUri(uri);
  const id = sp.idFromUri(uri);
  try {
    if (uri.endsWith(':collection')) return { uri: `spotify:user:${userId}:collection`, name: 'Lieblingssongs', route: { name: 'liked' } };
    if (type === 'playlist') {
      const p = await sp.playlist(id);
      return { uri, name: p.name, image: pickImage(p.images, 120), route: { name: 'playlist', id } };
    }
    if (type === 'album') {
      const a = await sp.album(id);
      return { uri, name: a.name, image: pickImage(a.images, 120), route: { name: 'album', id } };
    }
    if (type === 'artist') {
      const a = await sp.artist(id);
      return { uri, name: a.name, image: pickImage(a.images, 120), route: { name: 'artist', id } };
    }
  } catch {
    /* z.B. gelöschte Playlist */
  }
  return null;
}

export function Home() {
  const { navigate } = useUi();
  const p = usePlayer();

  const { data } = useAsync(async () => {
    const [user, recent, artists, tracks, playlists] = await Promise.all([
      sp.me(),
      sp.recentlyPlayed().catch(() => null),
      sp.topArtists().catch(() => null),
      sp.topTracks().catch(() => null),
      sp.myPlaylists().catch(() => null),
    ]);
    const ctxUris = [...new Set((recent?.items ?? []).map((i) => i.context?.uri).filter(Boolean) as string[])].slice(0, 8);
    let tiles = (await Promise.all(ctxUris.map((u) => resolveContext(u, user.id)))).filter(Boolean) as Tile[];
    if (tiles.length < 4 && playlists)
      tiles = [
        ...tiles,
        ...playlists.items
          .filter((pl) => pl && !tiles.some((t) => t.uri === pl.uri))
          .map((pl) => ({ uri: pl.uri, name: pl.name, image: pickImage(pl.images, 120), route: { name: 'playlist', id: pl.id } as Route })),
      ].slice(0, 8);
    return { user, tiles, artists: artists?.items ?? [], tracks: tracks?.items ?? [], playlists: playlists?.items.filter(Boolean) ?? [] };
  }, []);

  const name = data?.user.display_name?.split(' ')[0];

  return (
    <div className="px-8 pb-40 pt-10">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[clamp(34px,3.8vw,56px)] font-semibold leading-none tracking-[-0.05em]"
      >
        {greeting()}
        {name ? `, ${name}` : ''}
      </motion.h1>

      {/* Schnellzugriff */}
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
        {!data && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="r-media h-16" />)}
        {data?.tiles.map((t, i) => {
          const here = p.state?.context?.uri === t.uri;
          return (
            <motion.div
              key={t.uri}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              role="button"
              tabIndex={0}
              onClick={() => navigate(t.route)}
              className="group r-media flex h-16 items-center gap-3 overflow-hidden border border-line bg-white/[0.04] pr-3 transition-colors hover:border-white/15 hover:bg-white/[0.08]"
            >
              {t.route.name === 'liked' ? (
                <div className="grid size-16 shrink-0 place-items-center bg-gradient-to-br from-accent to-glow text-xl">♥</div>
              ) : (
                <Cover src={t.image} className="size-16 rounded-none" />
              )}
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{t.name}</span>
              {here && p.isPlaying ? (
                <Equalizer />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    p.playContext(t.uri);
                  }}
                  aria-label="Abspielen"
                  className="glow grid size-9 place-items-center rounded-full bg-accent text-black opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Play className="ml-0.5 size-4" fill="currentColor" strokeWidth={0} />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {!!data?.tracks.length && (
        <section className="mt-12">
          <SectionTitle>Deine Lieblinge gerade</SectionTitle>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-4 gap-y-1">
            {data.tracks.slice(0, 12).map((t) => {
              const cur = p.item?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => p.playUris(data.tracks.map((x) => x.uri), t.uri)}
                  className="group r-media flex items-center gap-3 p-2 text-left hover:bg-white/[0.05]"
                >
                  <Cover src={pickImage(t.album.images, 64)} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[14px] font-medium ${cur ? 'text-accent' : ''}`}>{t.name}</div>
                    <div className="truncate text-[12.5px] text-mute">{t.artists.map((a) => a.name).join(', ')}</div>
                  </div>
                  {cur && p.isPlaying && <Equalizer />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!!data?.artists.length && (
        <section className="mt-12">
          <SectionTitle>Deine Top-Künstler</SectionTitle>
          <CardGrid>
            {data.artists.slice(0, 12).map((a) => (
              <MediaCard
                key={a.id}
                round
                image={pickImage(a.images, 300)}
                title={a.name}
                sub="Künstler"
                onOpen={() => navigate({ name: 'artist', id: a.id })}
                onPlay={() => p.playContext(a.uri)}
              />
            ))}
          </CardGrid>
        </section>
      )}

      {!!data?.playlists.length && (
        <section className="mt-12">
          <SectionTitle>Deine Playlists</SectionTitle>
          <CardGrid>
            {data.playlists.slice(0, 18).map((pl) => (
              <MediaCard
                key={pl.id}
                image={pickImage(pl.images, 300)}
                title={pl.name}
                sub={`von ${pl.owner.display_name ?? pl.owner.id}`}
                onOpen={() => navigate({ name: 'playlist', id: pl.id })}
                onPlay={() => p.playContext(pl.uri)}
              />
            ))}
          </CardGrid>
        </section>
      )}
    </div>
  );
}
