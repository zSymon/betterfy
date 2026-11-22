import { Heart, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { ActionBar, CollectionHeader, Dot } from '../components/Collection';
import { TrackTable } from '../components/TrackTable';
import { ErrorNote } from '../components/ui';
import { toPlayable } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { usePaged } from '../lib/paged';
import * as sp from '../lib/spotify';
import type { Playable } from '../lib/types';

export function Liked() {
  const { data: user } = useAsync(() => sp.me(), []);
  const list = usePaged((o) => sp.savedTracks(o), 'liked');
  const tracks = useMemo(() => list.items.map((i) => toPlayable(i.track, undefined, i.added_at)).filter(Boolean) as Playable[], [list.items]);
  const ctx = user ? `spotify:user:${user.id}:collection` : undefined;

  return (
    <div className="pb-40">
      <CollectionHeader
        kind="Playlist"
        title="Lieblingssongs"
        imageNode={
          <div className="grid size-[clamp(150px,17vw,232px)] place-items-center rounded-2xl bg-gradient-to-br from-accent via-glow to-base shadow-[0_24px_60px_-12px_rgb(0_0_0/0.7)]">
            <Heart className="size-1/3 text-white drop-shadow-lg" fill="currentColor" strokeWidth={0} />
          </div>
        }
        meta={
          <>
            <span className="font-semibold text-ink">{user?.display_name}</span>
            {list.total != null && (
              <>
                <Dot />
                <span>{list.total} Songs</span>
              </>
            )}
          </>
        }
      />
      <ActionBar contextUri={ctx} />
      <div className="px-5">
        {list.error ? <ErrorNote error={list.error} /> : <TrackTable tracks={tracks} contextUri={ctx} showAdded likedView />}
        <div ref={list.sentinel} className="grid h-16 place-items-center text-mute">
          {list.loading && <Loader2 className="size-5 animate-spin" />}
        </div>
      </div>
    </div>
  );
}
