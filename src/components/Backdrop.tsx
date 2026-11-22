import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { DEFAULT_PALETTE, paletteFromImage } from '../lib/color';
import { useDesign, type Background } from '../state/design';
import { usePlayer } from '../state/player';
import { itemImage } from './PlayerBar';

/** Setzt --base/--glow/--accent: aus dem Cover oder aus der festen Akzentfarbe. */
export function usePaletteVars(src: string | undefined, accent: string) {
  useEffect(() => {
    let stop = false;
    const root = document.documentElement.style;
    if (accent !== 'cover') {
      root.setProperty('--accent', accent);
      root.setProperty('--glow', `color-mix(in oklab, ${accent} 36%, #0a0b0f)`);
      root.setProperty('--base', `color-mix(in oklab, ${accent} 9%, #07080b)`);
      return;
    }
    (src ? paletteFromImage(src) : Promise.resolve(DEFAULT_PALETTE)).then((p) => {
      if (stop) return;
      root.setProperty('--base', `rgb(${p.base})`);
      root.setProperty('--glow', `rgb(${p.glow})`);
      root.setProperty('--accent', `rgb(${p.accent})`);
    });
    return () => {
      stop = true;
    };
  }, [src, accent]);
}

export function Backdrop() {
  const { item } = usePlayer();
  const { design } = useDesign();
  const src = itemImage(item, 300);
  usePaletteVars(src, design.accent);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <BackdropLayers mode={design.background} src={src} />
    </div>
  );
}

/** Die eigentlichen Hintergrund-Ebenen – auch für die Vorschau im Design-Tab genutzt. */
export function BackdropLayers({ mode, src }: { mode: Background; src?: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: mode === 'minimal' ? '#060709' : 'color-mix(in oklab, var(--base) 75%, black)' }}>
      {mode === 'aurora' && (
        <>
          <AnimatePresence>
            {src && (
              <motion.img
                key={src}
                src={src}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6 }}
                className="absolute -inset-[10%] size-[120%] scale-110 object-cover blur-[90px] saturate-150"
              />
            )}
          </AnimatePresence>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(1200px 700px at 15% -10%, color-mix(in srgb, var(--glow) 70%, transparent), transparent 70%),' +
                'radial-gradient(900px 600px at 100% 110%, color-mix(in srgb, var(--glow) 45%, transparent), transparent 70%)',
            }}
          />
        </>
      )}

      {mode === 'mesh' && (
        <>
          <div className="blob blob-a -left-[15%] -top-[25%]" style={{ background: 'var(--glow)' }} />
          <div className="blob blob-b -right-[20%] top-[10%]" style={{ background: 'color-mix(in oklab, var(--accent) 55%, var(--glow))' }} />
          <div className="blob blob-c -bottom-[40%] left-[20%]" style={{ background: 'color-mix(in oklab, var(--accent) 30%, #1b1040)' }} />
        </>
      )}

      {mode === 'grid' && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 45% at 50% 58%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%),' +
                'radial-gradient(60% 50% at 50% -10%, color-mix(in srgb, var(--glow) 60%, transparent), transparent 70%)',
            }}
          />
          <div className="absolute inset-x-0 top-[50%] h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.55 }} />
          <div className="absolute inset-x-0 bottom-0 top-[50%] overflow-hidden">
            <div className="grid-floor" style={{ top: 0, bottom: 'auto', height: '170%' }} />
          </div>
        </>
      )}

      {mode === 'minimal' && (
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(900px 500px at 0% 0%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%)' }}
        />
      )}

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(0_0_0/0.4))]" />
      <div className="noise absolute inset-0 mix-blend-overlay" style={{ opacity: 'var(--grain)' }} />
    </div>
  );
}
