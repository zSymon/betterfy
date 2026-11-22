import { Play, Search as SearchIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { CardGrid, MediaCard } from '../components/Collection';
import { TrackTable } from '../components/TrackTable';
import { Cover, ErrorNote, SectionTitle, Skeleton } from '../components/ui';
import { pickImage, toPlayable } from '../lib/format';
import { useAsync, useDebounced } from '../lib/hooks';
import * as sp from '../lib/spotify';
import type { Playable, PlaylistRef } from '../lib/types';
import { usePlayer } from '../state/player';
import { useUi } from '../state/ui';

export function SearchView({ q }: { q: string }) {
  const query = useDebounced(q.trim(), 320);
  const { navigate } = useUi();
  const p = usePlayer();
  const { data, error, loading } = useAsync(async () => (query ? sp.search(query) : null), [query]);

  const tracks = useMemo(() => (data?.tracks?.items ?? []).map((t) => toPlayable(t)).filter(Boolean) as Playable[], [data]);
  const playlists = (data?.playlists?.items ?? []).filter(Boolean) as PlaylistRef[];
  const top = data?.artists?.items[0];

  if (!query)
    return (
      <div className="grid h-[70%] place-items-center text-center text-mute">
        <div>
          <SearchIcon className="mx-auto mb-4 size-10 text-faint" />
          <p className="text-[18px] font-semibold text-ink">Finde deinen nächsten Lieblingssong</p>
          <p className="mt-1 text-[13.5px]">Songs, Künstler, Alben und Playlists</p>
        </div>
      </div>
    );
  if (error) return <ErrorNote error={error} />;

  return (
    <div className="px-6 pb-40 pt-8">
      {loading && !data ? (
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 px-2">
          <Skeleton className="h-64 rounded-2xl" />
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 px-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {top && (
              <section>
                <SectionTitle>Top-Ergebnis</SectionTitle>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate({ name: 'artist', id: top.id })}
                  className="group r-tile relative h-[236px] border border-line bg-white/[0.04] p-6 transition-colors hover:border-white/15 hover:bg-white/[0.07]"
                >
                  <Cover src={pickImage(top.images, 160)} round className="size-24 shadow-xl" />
                  <div className="mt-5 truncate text-[30px] font-semibold tracking-[-0.04em]">{top.name}</div>
                  <div className="text-[13px] text-mute">Künstler</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      p.playContext(top.uri);
                    }}
                    aria-label="Abspielen"
                    className="absolute bottom-6 right-6 grid size-12 translate-y-2 place-items-center rounded-full bg-accent text-black opacity-0 shadow-xl transition-all group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    <Play className="ml-0.5 size-5" fill="currentColor" strokeWidth={0} />
                  </button>
                </motion.div>
              </section>
            )}
            {!!tracks.length && (
              <section className="min-w-0">
                <SectionTitle>Songs</SectionTitle>
                <div className="-mx-3 [&_[role=table]>div:first-child]:hidden">
                  <TrackTable tracks={tracks.slice(0, 5)} showAlbum={false} />
                </div>
              </section>
            )}
          </div>

          {!!data?.artists?.items.length && (
            <section className="mt-10">
              <div className="px-2">
                <SectionTitle>Künstler</SectionTitle>
              </div>
              <CardGrid>
                {data.artists.items.map((a) => (
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

          {!!data?.albums?.items.length && (
            <section className="mt-10">
              <div className="px-2">
                <SectionTitle>Alben</SectionTitle>
              </div>
              <CardGrid>
                {data.albums.items.map((al) => (
                  <MediaCard
                    key={al.id}
                    image={pickImage(al.images, 300)}
                    title={al.name}
                    sub={`${al.release_date?.slice(0, 4) ?? ''} · ${al.artists.map((x) => x.name).join(', ')}`}
                    onOpen={() => navigate({ name: 'album', id: al.id })}
                    onPlay={() => p.playContext(al.uri)}
                  />
                ))}
              </CardGrid>
            </section>
          )}

          {!!playlists.length && (
            <section className="mt-10">
              <div className="px-2">
                <SectionTitle>Playlists</SectionTitle>
              </div>
              <CardGrid>
                {playlists.map((pl) => (
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

          {data && !top && !tracks.length && !data.albums?.items.length && (
            <p className="py-24 text-center text-mute">Keine Ergebnisse für „{query}“.</p>
          )}
        </>
      )}
    </div>
  );
}
