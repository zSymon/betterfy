import { Loader2, Lock } from 'lucide-react';
import { useMemo } from 'react';
import { ActionBar, CollectionHeader, Dot } from '../components/Collection';
import { TrackTable } from '../components/TrackTable';
import { ErrorNote } from '../components/ui';
import { pickImage, toPlayable } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { usePaged } from '../lib/paged';
import * as sp from '../lib/spotify';
import type { Playable } from '../lib/types';

export function PlaylistView({ id }: { id: string }) {
  const { data: pl, error, reload } = useAsync(() => sp.playlist(id), [id]);
  const { data: user } = useAsync(() => sp.me(), []);

  // Seit Feb. 2026 dürfen Dev-Mode-Apps nur Inhalte eigener/kollaborativer Playlists lesen.
  const readable = Boolean(pl && user && (pl.owner.id === user.id || pl.collaborative));
  const list = usePaged((o) => sp.playlistItems(id, o), id, readable);

  const tracks = useMemo(
    () => list.items.map((e) => toPlayable(e.item ?? e.track, undefined, e.added_at)).filter(Boolean) as Playable[],
    [list.items],
  );
  const total = (pl?.items as { total?: number } | undefined)?.total ?? pl?.tracks?.total ?? list.total;

  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="pb-40">
      <CollectionHeader
        image={pickImage(pl?.images, 300)}
        kind={pl?.public === false ? 'Private Playlist' : 'Playlist'}
        title={pl?.name}
        description={pl?.description}
        meta={
          pl && (
            <>
              <span className="font-semibold text-ink">{pl.owner.display_name ?? pl.owner.id}</span>
              {total != null && (
                <>
                  <Dot />
                  <span>{total} Songs</span>
                </>
              )}
            </>
          )
        }
      />
      <ActionBar contextUri={pl?.uri} />
      <div className="px-5">
        {pl && user && !readable && (
          <div className="mx-3 mt-2 flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-[13.5px] leading-relaxed text-mute">
            <Lock className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <div className="mb-1 font-semibold text-ink">Trackliste nicht verfügbar</div>
              Spotify erlaubt privaten Apps seit 2026 nur noch, die Songs deiner eigenen Playlists aufzulisten. Abspielen geht
              trotzdem – drück einfach auf Play.
            </div>
          </div>
        )}
        {list.error ? (
          <ErrorNote error={list.error} />
        ) : (
          readable && <TrackTable tracks={tracks} contextUri={pl?.uri} showAdded />
        )}
        <div ref={list.sentinel} className="grid h-16 place-items-center text-mute">
          {list.loading && <Loader2 className="size-5 animate-spin" />}
        </div>
      </div>
    </div>
  );
}
