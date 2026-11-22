import { aura } from './lib/bridge';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Backdrop } from './components/Backdrop';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WidgetBridge } from './components/WidgetBridge';
import { PlaybackHelp } from './components/PlaybackHelp';
import { Login } from './components/Login';
import { NowPlayingPanel } from './components/NowPlayingPanel';
import { PlayerBar } from './components/PlayerBar';
import { SidePanel } from './components/SidePanel';
import { Stage } from './components/Stage';
import { TopBar } from './components/TopBar';
import { cx } from './lib/format';
import { PlayerProvider, usePlayer } from './state/player';
import { UiProvider, useUi, type Route } from './state/ui';
import { AlbumView } from './views/Album';
import { ArtistView } from './views/Artist';
import { Home } from './views/Home';
import { Liked } from './views/Liked';
import { PlaylistView } from './views/Playlist';
import { SearchView } from './views/Search';
import { DesignView } from './views/Design';
import { DesignProvider, useDesign } from './state/design';

export default function App() {
  const [auth, setAuth] = useState<'unknown' | 'in' | 'out'>('unknown');

  useEffect(() => {
    aura().getConfig().then((c) => setAuth(c.loggedIn ? 'in' : 'out'));
  }, []);

  if (auth === 'unknown') return <div className="drag h-full" />;
  if (auth === 'out') return <Login onDone={() => setAuth('in')} />;

  return (
    <DesignProvider>
      <UiProvider>
        <PlayerProvider>
          <Shell
            onLogout={async () => {
              await aura().logout();
              setAuth('out');
            }}
          />
        </PlayerProvider>
      </UiProvider>
    </DesignProvider>
  );
}

function View({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'search':
      return <SearchView q={route.q ?? ''} />;
    case 'liked':
      return <Liked />;
    case 'playlist':
      return <PlaylistView id={route.id} />;
    case 'album':
      return <AlbumView id={route.id} />;
    case 'artist':
      return <ArtistView id={route.id} />;
    case 'design':
      return <DesignView />;
  }
}

function useShortcuts() {
  const p = usePlayer();
  const { setStage, stage, back, forward } = useUi();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if (e.key === ' ' && !typing) {
        e.preventDefault();
        p.toggle();
      } else if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault();
        p.next();
      } else if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        p.prev();
      } else if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault();
        p.setVolume(Math.min(100, p.volume + 10));
      } else if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault();
        p.setVolume(Math.max(0, p.volume - 10));
      } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setStage(!stage);
      } else if (e.altKey && e.key === 'ArrowLeft') back();
      else if (e.altKey && e.key === 'ArrowRight') forward();
    };
    // Maus-Seitentasten für Zurück/Vor
    const m = (e: MouseEvent) => {
      if (e.button === 3) back();
      if (e.button === 4) forward();
    };
    window.addEventListener('keydown', h);
    window.addEventListener('mouseup', m);
    return () => {
      window.removeEventListener('keydown', h);
      window.removeEventListener('mouseup', m);
    };
  }, [p, setStage, stage, back, forward]);
}

const LAYOUT_3 =
  'grid gap-2 px-2 pb-2 grid-cols-[minmax(0,1fr)_clamp(260px,22vw,330px)] min-[1180px]:grid-cols-[clamp(250px,20vw,310px)_minmax(0,1fr)_clamp(260px,22vw,330px)]';
const LAYOUT_2 = 'grid gap-2 px-2 pb-2 grid-cols-[minmax(0,1fr)_clamp(260px,22vw,330px)]';

function Shell({ onLogout }: { onLogout: () => void }) {
  const { route, toasts } = useUi();
  const { design } = useDesign();
  const LAYOUT = design.showLeft ? LAYOUT_3 : LAYOUT_2;
  useShortcuts();
  const routeKey = route.name === 'search' ? 'search' : JSON.stringify(route);

  return (
    <div className="relative flex h-full flex-col">
      <ErrorBoundary fallback={null}>
        <Backdrop />
      </ErrorBoundary>
      <TopBar onLogout={onLogout} />
      <WidgetBridge />

      <div className={cx(LAYOUT, 'min-h-0 flex-1')}>
        {design.showLeft && (
          <div className="hidden min-h-0 min-[1180px]:block">
            <NowPlayingPanel />
          </div>
        )}

        <main className="panel-main r-panel relative min-h-0 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={routeKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="scroll h-full"
            >
              <ErrorBoundary>
                <View route={route} />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>

        <div className="min-h-0">
          <SidePanel />
        </div>
      </div>

      <Stage />
      <PlaybackHelp />

      {/* Gleiches Raster wie das Layout → Player-Leiste sitzt exakt mittig über der Hauptspalte */}
      <div className={cx(LAYOUT, 'pointer-events-none absolute inset-x-0 bottom-5 z-40')}>
        {design.showLeft && <div className="hidden min-[1180px]:block" />}
        <div className="flex justify-center">
          <PlayerBar />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[132px] z-50 flex flex-col items-center gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className={cx(
                'glass-dark rounded-full px-5 py-2.5 text-[13px] font-medium',
                t.tone === 'error' ? 'text-red-200' : 'text-ink',
              )}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
