import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'search'; q?: string }
  | { name: 'liked' }
  | { name: 'playlist'; id: string }
  | { name: 'album'; id: string }
  | { name: 'artist'; id: string }
  | { name: 'design' };

export type SidePanel = 'library' | 'queue' | 'devices';

type Toast = { id: number; text: string; tone: 'info' | 'error' };

type UiCtx = {
  route: Route;
  navigate(r: Route): void;
  replace(r: Route): void;
  back(): void;
  forward(): void;
  canBack: boolean;
  canForward: boolean;
  side: SidePanel;
  setSide(p: SidePanel): void;
  toggleSide(p: SidePanel): void;
  stage: boolean;
  setStage(v: boolean): void;
  toasts: Toast[];
  toast(text: string, tone?: Toast['tone']): void;
  help: boolean;
  setHelp(v: boolean): void;
};

const Ctx = createContext<UiCtx | null>(null);

const same = (a: Route, b: Route) => JSON.stringify(a) === JSON.stringify(b);

/** Startansicht – im Mock-Modus per ?view=playlist:pl0 wählbar (für Layout-Tests). */
function initialRoute(): Route {
  const params = new URLSearchParams(location.search);
  const v = params.has('mock') ? params.get('view') : null;
  if (!v) return { name: 'home' };
  const [name, id] = v.split(':');
  return (id ? { name, id } : { name }) as Route;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [hist, setHist] = useState<{ stack: Route[]; i: number }>(() => ({ stack: [initialRoute()], i: 0 }));
  const [side, setSide] = useState<SidePanel>(() => (new URLSearchParams(location.search).get('side') as SidePanel) || 'library');
  const [stage, setStage] = useState(() => new URLSearchParams(location.search).has('stage'));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [help, setHelp] = useState(() => new URLSearchParams(location.search).has('mock') && new URLSearchParams(location.search).has('help'));
  const toastId = useRef(0);

  const navigate = useCallback((r: Route) => {
    setStage(false);
    setHist((h) => {
      if (same(h.stack[h.i], r)) return h;
      const stack = [...h.stack.slice(0, h.i + 1), r].slice(-50);
      return { stack, i: stack.length - 1 };
    });
  }, []);

  const replace = useCallback((r: Route) => {
    setHist((h) => {
      const stack = [...h.stack];
      stack[h.i] = r;
      return { stack, i: h.i };
    });
  }, []);

  const back = useCallback(() => setHist((h) => ({ ...h, i: Math.max(0, h.i - 1) })), []);
  const forward = useCallback(() => setHist((h) => ({ ...h, i: Math.min(h.stack.length - 1, h.i + 1) })), []);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const toggleSide = useCallback((p: SidePanel) => setSide((s) => (s === p ? 'library' : p)), []);

  const value = useMemo<UiCtx>(
    () => ({
      route: hist.stack[hist.i],
      navigate,
      replace,
      back,
      forward,
      canBack: hist.i > 0,
      canForward: hist.i < hist.stack.length - 1,
      side,
      setSide,
      toggleSide,
      stage,
      setStage,
      toasts,
      toast,
      help,
      setHelp,
    }),
    [hist, navigate, replace, back, forward, side, toggleSide, stage, toasts, toast, help],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi() {
  const c = useContext(Ctx);
  if (!c) throw new Error('UiProvider fehlt');
  return c;
}
