import { Heart, Laptop, Loader2, Search, Smartphone, Speaker, Tv, Volume2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { cx, pickImage, toPlayable } from '../lib/format';
import { useAsync } from '../lib/hooks';
import * as sp from '../lib/spotify';
import type { AlbumRef, Artist, PlaylistRef } from '../lib/types';
import { usePlayer } from '../state/player';
import { useUi } from '../state/ui';
import { Chip, Cover, IconButton } from './ui';

export function SidePanel() {
  const { side } = useUi();
  return (
    <aside className="glass r-panel relative flex h-full flex-col overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={side}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {side === 'library' && <Library />}
          {side === 'queue' && <Queue />}
          {side === 'devices' && <Devices />}
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

function PanelHeader({ title, onClose }: { title: string; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pb-2 pt-4">
      <h2 className="text-[16px] font-semibold tracking-[-0.02em]">{title}</h2>
      {onClose && (
        <IconButton label="Schließen" size="sm" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      )}
    </div>
  );
}

// ---------------- Bibliothek ----------------
type Filter = 'playlists' | 'albums' | 'artists';
type LibItem = { kind: Filter | 'liked'; id: string; uri: string; name: string; sub: string; image?: string };

function Library() {
  const [filter, setFilter] = useState<Filter | null>(null);
  const [q, setQ] = useState('');
  const { route, navigate } = useUi();
  const { state, isPlaying } = usePlayer();

  const { data, loading } = useAsync(async () => {
    const [user, pl, al, ar, liked] = await Promise.all([
      sp.me(),
      sp.myPlaylists().then((p) => sp.all(p, 500)),
      sp.savedAlbums().then((p) => sp.all(p, 300)).catch(() => []),
      sp.followedArtists().then((r) => sp.all(r.artists, 300)).catch(() => [] as Artist[]),
      sp.savedTracks(0, 1).catch(() => null),
    ]);
    return { user, pl: pl.filter(Boolean) as PlaylistRef[], al: al.map((x) => x.album as AlbumRef), ar, likedTotal: liked?.total ?? 0 };
  }, []);

  const items = useMemo<LibItem[]>(() => {
    if (!data) return [];
    const out: LibItem[] = [];
    if (!filter || filter === 'playlists') {
      out.push({ kind: 'liked', id: 'liked', uri: `spotify:user:${data.user.id}:collection`, name: 'Lieblingssongs', sub: `Playlist · ${data.likedTotal} Songs` });
      for (const p of data.pl)
        out.push({
          kind: 'playlists',
          id: p.id,
          uri: p.uri,
          name: p.name,
          sub: `Playlist · ${p.owner.id === data.user.id ? 'Du' : (p.owner.display_name ?? p.owner.id)}`,
          image: pickImage(p.images, 64),
        });
    }
    if (!filter || filter === 'albums')
      for (const a of data.al)
        out.push({ kind: 'albums', id: a.id, uri: a.uri, name: a.name, sub: `Album · ${a.artists.map((x) => x.name).join(', ')}`, image: pickImage(a.images, 64) });
    if (!filter || filter === 'artists')
      for (const a of data.ar) out.push({ kind: 'artists', id: a.id, uri: a.uri, name: a.name, sub: 'Künstler', image: pickImage(a.images, 64) });
    const needle = q.trim().toLowerCase();
    return needle ? out.filter((i) => i.name.toLowerCase().includes(needle) || i.sub.toLowerCase().includes(needle)) : out;
  }, [data, filter, q]);

  const isRouteFor = (i: LibItem) =>
    (i.kind === 'liked' && route.name === 'liked') ||
    (i.kind === 'playlists' && route.name === 'playlist' && route.id === i.id) ||
    (i.kind === 'albums' && route.name === 'album' && route.id === i.id) ||
    (i.kind === 'artists' && route.name === 'artist' && route.id === i.id);

  const open = (i: LibItem) =>
    navigate(
      i.kind === 'liked' ? { name: 'liked' }
      : i.kind === 'playlists' ? { name: 'playlist', id: i.id }
      : i.kind === 'albums' ? { name: 'album', id: i.id }
      : { name: 'artist', id: i.id },
    );

  return (
    <>
      <PanelHeader title="Deine Bibliothek" />
      <div className="flex gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none]">
        {(
          [
            ['playlists', 'Playlists'],
            ['albums', 'Alben'],
            ['artists', 'Künstler'],
          ] as const
        ).map(([k, label]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(filter === k ? null : k)}>
            {label}
          </Chip>
        ))}
      </div>
      <div className="mx-5 mb-2 flex h-9 items-center gap-2 rounded-full border border-line px-3 text-mute transition-colors focus-within:border-white/20">
        <Search className="size-4 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="In Bibliothek suchen"
          className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
      </div>
      <div className="scroll fade-bottom min-h-0 flex-1 px-2.5 pb-10">
        {loading && !data && (
          <div className="grid place-items-center py-10 text-mute">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {items.map((i) => {
          const playingHere = state?.context?.uri === i.uri;
          return (
            <button
              key={i.kind + i.id}
              onClick={() => open(i)}
              className={cx(
                'flex w-full items-center gap-3 rounded-[calc(var(--r)*0.55)] p-2 text-left transition-colors',
                isRouteFor(i) ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]',
              )}
            >
              {i.kind === 'liked' ? (
                <div className="r-media grid size-12 shrink-0 place-items-center bg-gradient-to-br from-accent to-glow">
                  <Heart className="size-5 text-white" fill="currentColor" strokeWidth={0} />
                </div>
              ) : (
                <Cover src={i.image} round={i.kind === 'artists'} className="size-12" />
              )}
              <div className="min-w-0 flex-1">
                <div className={cx('truncate text-[14px] font-medium', playingHere ? 'glow-text text-accent' : 'text-ink')}>{i.name}</div>
                <div className="truncate text-[12px] text-mute">{i.sub}</div>
              </div>
              {playingHere && isPlaying && <Volume2 className="mr-1 size-4 shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------------- Warteschlange ----------------
function Queue() {
  const { setSide, navigate } = useUi();
  const { item, playUris } = usePlayer();
  const { data, loading, reload } = useAsync(() => sp.queue(), [item?.id]);
  useEffect(() => {
    const t = setInterval(reload, 15_000);
    return () => clearInterval(t);
  }, [reload]);

  const now = toPlayable(data?.currently_playing ?? null);
  const next = (data?.queue ?? []).map((t) => toPlayable(t)).filter(Boolean).slice(0, 40);

  return (
    <>
      <PanelHeader title="Warteschlange" onClose={() => setSide('library')} />
      <div className="scroll fade-bottom min-h-0 flex-1 px-2.5 pb-10">
        {loading && !data && (
          <div className="grid place-items-center py-10 text-mute">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {now && (
          <>
            <div className="hud px-2.5 pb-2 pt-1">Läuft gerade</div>
            <QueueRow p={now} active />
          </>
        )}
        {next.length > 0 && <div className="hud px-2.5 pb-2 pt-5">Als Nächstes</div>}
        {next.map((p, i) => (
          <QueueRow
            key={p!.uri + i}
            p={p!}
            onClick={() => playUris(next.slice(i).map((x) => x!.uri))}
            onArtist={(id) => navigate({ name: 'artist', id })}
          />
        ))}
        {data && !now && !next.length && <p className="px-3 py-8 text-center text-sm text-mute">Die Warteschlange ist leer.</p>}
      </div>
    </>
  );
}

function QueueRow({
  p,
  active,
  onClick,
  onArtist,
}: {
  p: NonNullable<ReturnType<typeof toPlayable>>;
  active?: boolean;
  onClick?: () => void;
  onArtist?: (id: string) => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.06]">
      <Cover src={p.image} className="size-11" />
      <div className="min-w-0 flex-1">
        <div className={cx('truncate text-[13.5px] font-medium', active ? 'text-accent' : 'text-ink')}>{p.name}</div>
        <div className="truncate text-[12px] text-mute" onClick={(e) => (onArtist && p.artists[0]?.id ? (e.stopPropagation(), onArtist(p.artists[0].id)) : undefined)}>
          {p.artists.map((a) => a.name).join(', ')}
        </div>
      </div>
    </button>
  );
}

// ---------------- Geräte ----------------
const deviceIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'smartphone' || t === 'tablet') return Smartphone;
  if (t === 'speaker' || t === 'avr' || t === 'stb' || t === 'audiodongle') return Speaker;
  if (t === 'tv' || t === 'castvideo') return Tv;
  return Laptop;
};

function Devices() {
  const { setSide, setHelp } = useUi();
  const { devices, refreshDevices, transfer, sdk } = usePlayer();
  useEffect(() => {
    refreshDevices();
    const t = setInterval(refreshDevices, 5000);
    return () => clearInterval(t);
  }, [refreshDevices]);

  return (
    <>
      <PanelHeader title="Wiedergabe auf" onClose={() => setSide('library')} />
      <div className="scroll min-h-0 flex-1 space-y-1 px-2.5 pb-6">
        {devices.map((d) => {
          const Icon = deviceIcon(d.type);
          const isBetterfy = d.id === sdk.deviceId;
          return (
            <button
              key={d.id ?? d.name}
              disabled={!d.id || d.is_restricted}
              onClick={() => d.id && transfer(d.id)}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors disabled:opacity-40',
                d.is_active ? 'bg-accent/10 ring-1 ring-inset ring-accent/25' : 'hover:bg-white/[0.05]',
              )}
            >
              <div className={cx('grid size-10 place-items-center rounded-full', d.is_active ? 'glow bg-accent text-black' : 'bg-white/10')}>
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className={cx('truncate text-[14px] font-semibold', d.is_active && 'text-accent')}>
                  {isBetterfy ? 'Dieser Computer (Betterfy)' : d.name}
                </div>
                <div className="text-[12px] text-mute">{d.is_active ? 'Spielt gerade' : d.type}</div>
              </div>
            </button>
          );
        })}

        {sdk.status === 'loading' && (
          <div className="flex items-center gap-3 p-3 text-[13px] text-mute">
            <Loader2 className="size-4 animate-spin" /> Betterfy-Player wird gestartet …
          </div>
        )}
        {sdk.status === 'error' && (
          <div className="mx-1 mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-[12.5px] leading-relaxed text-mute">
            <div className="mb-1 font-semibold text-ink">In-App-Wiedergabe nicht verfügbar</div>
            {sdk.error}
            <button onClick={() => setHelp(true)} className="mt-3 block rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-black">
              So behebst du das
            </button>
          </div>
        )}
        {!devices.length && sdk.status !== 'loading' && (
          <p className="px-3 py-6 text-center text-sm text-mute">Keine Geräte gefunden.</p>
        )}
      </div>
    </>
  );
}
