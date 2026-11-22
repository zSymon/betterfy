// Medientasten der Tastatur + Windows-Mediensteuerung (Lautstärke-Overlay, Sperrbildschirm).
// - navigator.mediaSession: Titel, Interpret und Cover für Windows, Knöpfe im Overlay steuern Betterfy.
// - Hat Betterfy ein aktives Gerät, fängt der Hauptprozess Play/Pause, Vor und Zurück global ab
//   (funktioniert so auch, wenn die Musik auf dem Handy oder in der Spotify-App läuft).
import { useEffect, useRef } from 'react';
import { aura } from '../lib/bridge';
import { usePlayer } from '../state/player';
import { itemArtists, itemImage } from './PlayerBar';

export function MediaKeys() {
  const p = usePlayer();
  const ref = useRef(p);
  ref.current = p;
  const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;

  // Songinfos für Windows
  const item = p.item;
  const cover = itemImage(item, 300);
  useEffect(() => {
    if (!ms) return;
    if (!item) {
      ms.metadata = null;
      return;
    }
    ms.metadata = new MediaMetadata({
      title: item.name,
      artist: itemArtists(item).map((a) => a.name).join(', '),
      album: 'album' in item ? item.album?.name : 'show' in item ? item.show?.name : undefined,
      artwork: cover ? [{ src: cover, sizes: '300x300', type: 'image/jpeg' }] : [],
    });
  }, [ms, item?.uri, cover]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ms) ms.playbackState = item ? (p.isPlaying ? 'playing' : 'paused') : 'none';
  }, [ms, p.isPlaying, item]);

  useEffect(() => {
    if (!ms || !item?.duration_ms) return;
    const c = p.clock;
    const pos = Math.min(item.duration_ms, c.playing ? c.pos + (performance.now() - c.at) : c.pos);
    try {
      ms.setPositionState({ duration: item.duration_ms / 1000, position: Math.max(0, pos / 1000), playbackRate: 1 });
    } catch {
      /* ungültige Werte ignorieren */
    }
  }, [ms, p.clock, item?.duration_ms]); // eslint-disable-line react-hooks/exhaustive-deps

  // Knöpfe im Windows-Overlay
  useEffect(() => {
    if (!ms) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => !ref.current.isPlaying && ref.current.toggle()],
      ['pause', () => ref.current.isPlaying && ref.current.toggle()],
      ['stop', () => ref.current.isPlaying && ref.current.toggle()],
      ['nexttrack', () => ref.current.next()],
      ['previoustrack', () => ref.current.prev()],
      ['seekto', (d) => d.seekTime != null && ref.current.seek(Math.round(d.seekTime * 1000))],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* Aktion nicht unterstützt */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* egal */
        }
      }
    };
  }, [ms]);

  // Tastatur-Medientasten global, solange Betterfy ein aktives Gerät steuert – sonst bleiben sie für andere Apps frei.
  const active = Boolean(p.state?.device?.is_active);
  useEffect(() => {
    aura().setMediaKeys(active);
  }, [active]);
  useEffect(() => () => aura().setMediaKeys(false), []);

  return null;
}
