// Schickt den Player-Status live ans Desktop-Widget und führt Befehle vom Widget aus.
// So reagiert das Widget sofort (SDK-Events) statt erst beim nächsten API-Poll.
import { useEffect, useRef } from 'react';
import { aura } from '../lib/bridge';
import { usePlayer } from '../state/player';

export type BridgeState = {
  state: ReturnType<typeof usePlayer>['state'];
  /** Position zum Zeitpunkt `at` (Epoch-ms), damit das Widget fensterübergreifend interpolieren kann */
  clock: { pos: number; at: number; playing: boolean };
  liked: boolean;
  volume: number;
};

export function WidgetBridge() {
  const p = usePlayer();
  const ref = useRef(p);
  ref.current = p;

  useEffect(() => {
    const c = p.clock;
    const pos = c.playing ? c.pos + (performance.now() - c.at) : c.pos;
    const msg: BridgeState = { state: p.state, clock: { pos, at: Date.now(), playing: c.playing }, liked: p.liked, volume: p.volume };
    aura().sendPlayerState(msg);
  }, [p.state, p.clock, p.liked, p.volume]);

  // Herzschlag, damit das Widget weiß, dass die Brücke aktiv ist
  useEffect(() => {
    const t = setInterval(() => {
      const { state, clock, liked, volume } = ref.current;
      const pos = clock.playing ? clock.pos + (performance.now() - clock.at) : clock.pos;
      aura().sendPlayerState({ state, clock: { pos, at: Date.now(), playing: clock.playing }, liked, volume } satisfies BridgeState);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(
    () =>
      aura().on('player:command', ({ cmd, arg }: { cmd: string; arg?: number }) => {
        const pl = ref.current;
        switch (cmd) {
          case 'toggle':
            return pl.toggle();
          case 'next':
            return pl.next();
          case 'prev':
            return pl.prev();
          case 'shuffle':
            return pl.toggleShuffle();
          case 'like':
            return pl.toggleLike();
          case 'volume':
            return typeof arg === 'number' && pl.setVolume(arg);
          case 'seek':
            return typeof arg === 'number' && pl.seek(arg);
        }
      }),
    [],
  );

  return null;
}
