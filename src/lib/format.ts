import type { AlbumRef, Episode, Image, Playable, Track } from './types';

export function fmtTime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function fmtDuration(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} Min.`;
  return `${Math.floor(min / 60)} Std. ${min % 60} Min.`;
}

export function fmtDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = (Date.now() - d.getTime()) / 86_400_000;
  if (days < 1) return 'Heute';
  if (days < 2) return 'Gestern';
  if (days < 7) return `vor ${Math.floor(days)} Tagen`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Wählt das kleinste Bild, das mindestens `min` Pixel breit ist. */
export function pickImage(images: Image[] | null | undefined, min = 300) {
  if (!images?.length) return undefined;
  const sorted = [...images].sort((a, b) => (a.width ?? 640) - (b.width ?? 640));
  return (sorted.find((i) => (i.width ?? 640) >= min) ?? sorted[sorted.length - 1]).url;
}

export function toPlayable(t: Track | Episode | null | undefined, album?: AlbumRef, addedAt?: string | null): Playable | null {
  if (!t || !t.uri) return null;
  if (t.type === 'episode') {
    const e = t as Episode;
    return {
      id: e.id,
      uri: e.uri,
      name: e.name,
      durationMs: e.duration_ms,
      artists: e.show ? [{ id: e.show.id, name: e.show.name, uri: e.show.uri }] : [],
      image: pickImage(e.images ?? e.show?.images, 64),
      addedAt,
    };
  }
  const tr = t as Track;
  const alb = tr.album ?? album;
  return {
    id: tr.id,
    uri: tr.uri,
    name: tr.name,
    durationMs: tr.duration_ms,
    explicit: tr.explicit,
    artists: tr.artists ?? [],
    album: alb,
    image: pickImage(alb?.images, 64),
    addedAt,
    isLocal: tr.is_local,
  };
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
