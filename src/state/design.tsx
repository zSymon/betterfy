// Design-Einstellungen: werden live als CSS-Variablen/Data-Attribute angewendet und dauerhaft gespeichert.
import { MotionConfig } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { aura } from '../lib/bridge';

export type Background = 'aurora' | 'mesh' | 'grid' | 'minimal';
export type Density = 'compact' | 'normal' | 'airy';
export type FontId = 'geist' | 'inter' | 'space' | 'sora';

export type Design = {
  /** 'cover' = Farbe aus dem Album-Cover, sonst feste Hex-Farbe */
  accent: string;
  background: Background;
  /** Glas-Deckkraft 0–100 */
  glass: number;
  /** Unschärfe in px */
  blur: number;
  /** Eckenradius der Panels in px */
  radius: number;
  density: Density;
  font: FontId;
  glow: boolean;
  grain: boolean;
  animate: boolean;
  reduceMotion: boolean;
  showLeft: boolean;
  showLyrics: boolean;
  showArtist: boolean;
};

export const DEFAULT_DESIGN: Design = {
  accent: 'cover',
  background: 'aurora',
  glass: 40,
  blur: 32,
  radius: 20,
  density: 'normal',
  font: 'geist',
  glow: true,
  grain: true,
  animate: true,
  reduceMotion: false,
  showLeft: true,
  showLyrics: true,
  showArtist: true,
};

export const PRESETS: { id: string; name: string; hint: string; design: Partial<Design> }[] = [
  { id: 'aurora', name: 'Aurora', hint: 'Farben aus dem Cover, weiches Glas', design: {} },
  {
    id: 'neon',
    name: 'Neon',
    hint: 'Cyber-Grid, Cyan, starker Glow',
    design: { accent: '#5ce1ff', background: 'grid', glass: 25, blur: 24, radius: 12, font: 'space', glow: true, grain: false },
  },
  {
    id: 'mono',
    name: 'Mono',
    hint: 'Reduziert, fast schwarz, kein Glow',
    design: { accent: '#e6ebf2', background: 'minimal', glass: 30, blur: 20, radius: 10, font: 'geist', glow: false, grain: false, density: 'compact' },
  },
  {
    id: 'bloom',
    name: 'Bloom',
    hint: 'Fließende Farbwolken, rund und weich',
    design: { accent: '#ff7ac6', background: 'mesh', glass: 55, blur: 44, radius: 28, font: 'sora', glow: true, grain: true, density: 'airy' },
  },
];

export const FONTS: Record<FontId, { name: string; css: string }> = {
  geist: { name: 'Geist', css: "'Geist Variable'" },
  inter: { name: 'Inter', css: "'Inter Variable'" },
  space: { name: 'Space Grotesk', css: "'Space Grotesk Variable'" },
  sora: { name: 'Sora', css: "'Sora Variable'" },
};

const ROW: Record<Density, number> = { compact: 46, normal: 56, airy: 66 };

type Ctx = { design: Design; set(patch: Partial<Design>): void; reset(): void };
const DesignCtx = createContext<Ctx | null>(null);

export function applyDesign(d: Design) {
  const root = document.documentElement;
  root.dataset.bg = d.background;
  root.dataset.glow = d.glow ? 'on' : 'off';
  root.dataset.animate = d.animate && !d.reduceMotion ? 'on' : 'off';
  const s = root.style;
  s.setProperty('--app-font', `${FONTS[d.font].css}, ui-sans-serif, system-ui, sans-serif`);
  s.setProperty('--r', `${d.radius}px`);
  s.setProperty('--blur', `${d.blur}px`);
  s.setProperty('--glass-a', String(0.015 + (d.glass / 100) * 0.13));
  s.setProperty('--row', `${ROW[d.density]}px`);
  s.setProperty('--grain', d.grain ? '0.07' : '0');
}

export function DesignProvider({ children }: { children: ReactNode }) {
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  const loaded = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    aura()
      .getConfig()
      .then((c) => {
        const saved = (c.prefs?.design ?? {}) as Partial<Design>;
        setDesign({ ...DEFAULT_DESIGN, ...saved });
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    applyDesign(design);
    if (!loaded.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => aura().savePrefs({ design }), 400);
  }, [design]);

  const set = useCallback((patch: Partial<Design>) => setDesign((d) => ({ ...d, ...patch })), []);
  const reset = useCallback(() => setDesign(DEFAULT_DESIGN), []);
  const value = useMemo(() => ({ design, set, reset }), [design, set, reset]);

  return (
    <DesignCtx.Provider value={value}>
      <MotionConfig reducedMotion={design.reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>
    </DesignCtx.Provider>
  );
}

export function useDesign() {
  const c = useContext(DesignCtx);
  if (!c) throw new Error('DesignProvider fehlt');
  return c;
}
