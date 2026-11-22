import { Heart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ActionBar, CollectionHeader, Dot } from '../components/Collection';
import { TrackTable } from '../components/TrackTable';
import { ErrorNote, IconButton } from '../components/ui';
import { cx, fmtDuration, pickImage, toPlayable } from '../lib/format';
import { useAsync } from '../lib/hooks';
import * as sp from '../lib/spotify';
import type { Playable, Track } from '../lib/types';
import { useUi } from '../state/ui';

export function AlbumView({ id }: { id: string }) {
  const { navigate, toast } = useUi();
  const { data, error, reload } = useAsync(async () => {
    const a = await sp.album(id);
    const tracks = a.tracks.next ? await sp.all(a.tracks, 500) : a.tracks.items;
    return { a, tracks };
  }, [id]);

  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!data) return;
    sp.libraryContains([data.a.uri]).then(([v]) => setSaved(Boolean(v))).catch(() => {});
  }, [data]);

  const tracks = useMemo(() => {
    if (!data) return [];
    const { images, ...ref } = data.a;
    return data.tracks.map((t) => toPlayable({ ...(t as Track), album: { ...ref, images } })).filter(Boolean) as Playable[];
  }, [data]);

  if (error) return <ErrorNote error={error} onRetry={reload} />;
  const a = data?.a;
  const duration = tracks.reduce((s, t) => s + t.durationMs, 0);

  return (
    <div className="pb-40">
      <CollectionHeader
        image={pickImage(a?.images, 300)}
        kind={a?.album_type === 'single' ? 'Single' : a?.album_type === 'compilation' ? 'Compilation' : 'Album'}
        title={a?.name}
        meta={
          a && (
            <>
              {a.artists.map((ar, i) => (
                <span key={ar.id}>
                  {i > 0 && ', '}
                  <button className="font-semibold text-ink hover:underline" onClick={() => navigate({ name: 'artist', id: ar.id })}>
                    {ar.name}
                  </button>
                </span>
              ))}
              <Dot />
              <span>{a.release_date?.slice(0, 4)}</span>
              <Dot />
              <span>
                {tracks.length} Songs, {fmtDuration(duration)}
              </span>
            </>
          )
        }
      />
      <ActionBar contextUri={a?.uri}>
        {a && (
          <IconButton
            label={saved ? 'Aus Bibliothek entfernen' : 'Zur Bibliothek hinzufügen'}
            onClick={async () => {
              const v = !saved;
              setSaved(v);
              try {
                await (v ? sp.librarySave([a.uri]) : sp.libraryRemove([a.uri]));
                toast(v ? 'Zur Bibliothek hinzugefügt' : 'Aus Bibliothek entfernt');
              } catch {
                setSaved(!v);
                toast('Hat nicht geklappt', 'error');
              }
            }}
          >
            <Heart className={cx('size-5', saved && 'text-accent')} fill={saved ? 'currentColor' : 'none'} strokeWidth={saved ? 0 : 2} />
          </IconButton>
        )}
      </ActionBar>
      <div className="px-5">
        <TrackTable tracks={tracks} contextUri={a?.uri} showAlbum={false} showCover={false} trackNumbers={data?.tracks.map((t) => t.track_number ?? 0)} />
        {a?.copyrights?.[0] && <p className="px-3 pt-8 text-[11px] text-faint">{a.copyrights[0].text}</p>}
      </div>
    </div>
  );
}
