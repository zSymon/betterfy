import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ActionBar, CardGrid, MediaCard } from '../components/Collection';
import { TrackTable } from '../components/TrackTable';
import { ErrorNote, SectionTitle, Skeleton } from '../components/ui';
import { pickImage, toPlayable } from '../lib/format';
import { useAsync } from '../lib/hooks';
import * as sp from '../lib/spotify';
import type { Playable } from '../lib/types';
import { usePlayer } from '../state/player';
import { useUi } from '../state/ui';

export function ArtistView({ id }: { id: string }) {
  const { navigate } = useUi();
  const p = usePlayer();
  const { data, error, reload } = useAsync(async () => {
    const [artist, albums] = await Promise.all([sp.artist(id), sp.artistAlbums(id).catch(() => null)]);
    // "Top-Tracks" gibt es seit 2026 nicht mehr → stattdessen die Suche nach dem Künstler nutzen.
    const found = await sp.search(`artist:"${artist.name}"`).catch(() => null);
    const tracks = (found?.tracks?.items ?? []).filter((t) => t.artists.some((a) => a.id === id));
    return { artist, albums: albums?.items ?? [], tracks };
  }, [id]);

  const tracks = useMemo(() => (data?.tracks ?? []).map((t) => toPlayable(t)).filter(Boolean) as Playable[], [data]);
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const a = data?.artist;
  const img = pickImage(a?.images, 640);
  const albums = (data?.albums ?? []).filter((x) => x.album_type === 'album');
  const singles = (data?.albums ?? []).filter((x) => x.album_type !== 'album');

  return (
    <div className="pb-40">
      {/* Hero */}
      <div className="relative h-[clamp(260px,38vh,400px)] overflow-hidden">
        {img && (
          <motion.img
            key={img}
            src={img}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 size-full object-cover object-[50%_25%]"
            draggable={false}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(10_12_11/0.9)] via-[rgb(10_12_11/0.25)] to-transparent" />
        <div className="absolute inset-x-8 bottom-7">
          <div className="hud !text-ink/70">Künstler</div>
          {a ? (
            <h1 className="mt-2 text-[clamp(44px,6.6vw,104px)] font-semibold leading-[0.92] tracking-[-0.055em] drop-shadow-xl">{a.name}</h1>
          ) : (
            <Skeleton className="mt-3 h-20 w-96" />
          )}
          {!!a?.genres?.length && <div className="mt-2 text-[14px] capitalize text-ink/75">{a.genres.slice(0, 4).join(' · ')}</div>}
        </div>
      </div>

      <div className="pt-6">
        <ActionBar contextUri={a?.uri} />
      </div>

      {!!tracks.length && (
        <section className="px-5">
          <div className="px-3">
            <SectionTitle>Songs</SectionTitle>
          </div>
          <TrackTable tracks={tracks.slice(0, 10)} />
        </section>
      )}

      {[
        ['Alben', albums],
        ['Singles & EPs', singles],
      ].map(([title, list]) =>
        (list as typeof albums).length ? (
          <section key={title as string} className="mt-10 px-6">
            <div className="px-2">
              <SectionTitle>{title as string}</SectionTitle>
            </div>
            <CardGrid>
              {(list as typeof albums).map((al) => (
                <MediaCard
                  key={al.id}
                  image={pickImage(al.images, 300)}
                  title={al.name}
                  sub={`${al.release_date?.slice(0, 4) ?? ''} · ${al.album_type === 'single' ? 'Single' : 'Album'}`}
                  onOpen={() => navigate({ name: 'album', id: al.id })}
                  onPlay={() => p.playContext(al.uri)}
                />
              ))}
            </CardGrid>
          </section>
        ) : null,
      )}
    </div>
  );
}
