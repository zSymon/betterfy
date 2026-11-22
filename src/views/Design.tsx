import { Check, Download, Loader2, Pipette, RefreshCw, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { aura } from '../lib/bridge';
import { BackdropLayers } from '../components/Backdrop';
import { itemImage } from '../components/PlayerBar';
import { cx } from '../lib/format';
import { DEFAULT_DESIGN, FONTS, PRESETS, useDesign, type Background, type Density, type Design, type FontId } from '../state/design';
import { usePlayer } from '../state/player';
import { useUpdate } from '../state/update';

const ACCENTS = ['#7ce8d2', '#5ce1ff', '#7c9bff', '#a78bfa', '#ff7ac6', '#ff8a5c', '#ffd166', '#c6f36b', '#e6ebf2'];

const BACKGROUNDS: { id: Background; name: string; hint: string }[] = [
  { id: 'aurora', name: 'Aurora', hint: 'Weichgezeichnetes Cover' },
  { id: 'mesh', name: 'Mesh', hint: 'Fließende Farbwolken' },
  { id: 'grid', name: 'Grid', hint: 'Futuristischer Horizont' },
  { id: 'minimal', name: 'Minimal', hint: 'Fast schwarz, ruhig' },
];

export function DesignView() {
  const { design, set, reset } = useDesign();
  const { item } = usePlayer();
  const cover = itemImage(item, 300);
  const activePreset = PRESETS.find((p) =>
    (Object.keys({ ...DEFAULT_DESIGN, ...p.design }) as (keyof Design)[]).every(
      (k) => ['showLeft', 'showLyrics', 'showArtist', 'reduceMotion', 'animate'].includes(k) || ({ ...DEFAULT_DESIGN, ...p.design })[k] === design[k],
    ),
  )?.id;

  return (
    <div className="mx-auto max-w-[980px] px-8 pb-44 pt-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="hud">Einstellungen / Design</div>
          <h1 className="mt-2 text-[clamp(34px,3.6vw,52px)] font-semibold leading-none tracking-[-0.045em]">Design</h1>
          <p className="mt-3 max-w-md text-[14px] text-mute">Alles wird sofort angewendet und gespeichert. Spiel einfach rum.</p>
        </div>
        <button
          onClick={reset}
          className="flex h-9 items-center gap-2 rounded-full border border-line px-4 text-[13px] text-mute transition hover:border-white/20 hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> Zurücksetzen
        </button>
      </div>

      {/* Presets */}
      <Section title="Presets" index="01">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PRESETS.map((p) => {
            const d = { ...DEFAULT_DESIGN, ...p.design };
            const active = activePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => set({ ...p.design, ...Object.fromEntries(Object.entries(DEFAULT_DESIGN).filter(([k]) => !(k in p.design) && !['showLeft', 'showLyrics', 'showArtist', 'reduceMotion', 'animate'].includes(k))) })}
                className="group flex flex-col justify-start text-left"
              >
                <Preview mode={d.background} src={cover} accent={d.accent} active={active} radius={d.radius}>
                  <span className="text-[17px] font-semibold tracking-tight" style={{ fontFamily: FONTS[d.font].css }}>
                    {p.name}
                  </span>
                </Preview>
                <div className="mt-2 px-1 text-[12px] text-mute">{p.hint}</div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Akzentfarbe */}
      <Section title="Akzentfarbe" index="02">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => set({ accent: 'cover' })}
            className={cx(
              'flex h-11 items-center gap-2.5 rounded-full border pl-1.5 pr-4 text-[13px] font-medium transition',
              design.accent === 'cover' ? 'border-accent/70 bg-accent/10 text-ink' : 'border-line text-mute hover:text-ink',
            )}
          >
            <span className="size-8 rounded-full bg-[conic-gradient(from_0deg,#ff7ac6,#ffd166,#c6f36b,#5ce1ff,#a78bfa,#ff7ac6)]" />
            Vom Cover
          </button>
          <span className="mx-1 h-6 w-px bg-line" />
          {ACCENTS.map((c) => (
            <button
              key={c}
              onClick={() => set({ accent: c })}
              aria-label={c}
              className="relative grid size-9 place-items-center rounded-full transition hover:scale-110"
              style={{ background: c, boxShadow: design.accent === c ? `0 0 0 2px #07080a, 0 0 0 4px ${c}, 0 0 24px ${c}` : undefined }}
            >
              {design.accent === c && <Check className="size-4 text-black/80" strokeWidth={3} />}
            </button>
          ))}
          <label
            className="relative grid size-9 cursor-pointer place-items-center rounded-full border border-dashed border-white/25 text-mute transition hover:border-white/50 hover:text-ink"
            title="Eigene Farbe"
          >
            <Pipette className="size-4" />
            <input
              type="color"
              value={design.accent.startsWith('#') ? design.accent : '#7ce8d2'}
              onChange={(e) => set({ accent: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </Section>

      {/* Hintergrund */}
      <Section title="Hintergrund" index="03">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {BACKGROUNDS.map((b) => (
            <button key={b.id} onClick={() => set({ background: b.id })} className="group flex flex-col justify-start text-left">
              <Preview mode={b.id} src={cover} active={design.background === b.id} radius={design.radius} />
              <div className="mt-2 px-1">
                <div className={cx('text-[13.5px] font-medium', design.background === b.id ? 'text-ink' : 'text-mute')}>{b.name}</div>
                <div className="text-[11.5px] text-faint">{b.hint}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Oberfläche */}
      <Section title="Oberfläche" index="04">
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          <Range label="Glas-Deckkraft" value={design.glass} min={0} max={100} unit="%" onChange={(v) => set({ glass: v })} />
          <Range label="Unschärfe" value={design.blur} min={0} max={64} unit="px" onChange={(v) => set({ blur: v })} />
          <Range label="Ecken" value={design.radius} min={4} max={32} unit="px" onChange={(v) => set({ radius: v })} />
          <div>
            <div className="mb-2.5 text-[13px] text-mute">Listendichte</div>
            <Segmented<Density>
              value={design.density}
              onChange={(v) => set({ density: v })}
              options={[
                ['compact', 'Kompakt'],
                ['normal', 'Normal'],
                ['airy', 'Luftig'],
              ]}
            />
          </div>
        </div>
      </Section>

      {/* Schrift */}
      <Section title="Schrift" index="05">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(Object.keys(FONTS) as FontId[]).map((f) => (
            <button
              key={f}
              onClick={() => set({ font: f })}
              className={cx(
                'r-tile border p-4 text-left transition',
                design.font === f ? 'border-accent/60 bg-accent/[0.08]' : 'border-line bg-white/[0.02] hover:border-white/15',
              )}
            >
              <div className="text-[40px] font-semibold leading-none tracking-tight" style={{ fontFamily: FONTS[f].css }}>
                Aa
              </div>
              <div className="mt-3 text-[13px] font-medium" style={{ fontFamily: FONTS[f].css }}>
                {FONTS[f].name}
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Effekte */}
      <Section title="Effekte" index="06">
        <div className="divide-y divide-line overflow-hidden r-tile border border-line bg-white/[0.02]">
          <Toggle label="Glow" hint="Leuchtende Akzente, Regler und Buttons" value={design.glow} onChange={(v) => set({ glow: v })} />
          <Toggle label="Körnung" hint="Feine Filmkörnung über dem Hintergrund" value={design.grain} onChange={(v) => set({ grain: v })} />
          <Toggle label="Animierter Hintergrund" hint="Bewegung bei Mesh und Grid" value={design.animate} onChange={(v) => set({ animate: v })} />
          <Toggle label="Reduzierte Bewegung" hint="Schaltet Animationen und Übergänge ab" value={design.reduceMotion} onChange={(v) => set({ reduceMotion: v })} />
        </div>
      </Section>

      {/* Layout */}
      <Section title="Layout" index="07">
        <div className="divide-y divide-line overflow-hidden r-tile border border-line bg-white/[0.02]">
          <Toggle label="Linke Spalte" hint="Cover, Songtext und Künstler neben der Hauptansicht" value={design.showLeft} onChange={(v) => set({ showLeft: v })} />
          <Toggle label="Songtext-Karte" value={design.showLyrics} disabled={!design.showLeft} onChange={(v) => set({ showLyrics: v })} />
          <Toggle label="Künstler-Karte" value={design.showArtist} disabled={!design.showLeft} onChange={(v) => set({ showArtist: v })} />
        </div>
      </Section>

      <WidgetSection />
      <AboutSection />
    </div>
  );
}

function AboutSection() {
  const { status, check, setOpen } = useUpdate();
  const [checking, setChecking] = useState(false);
  if (!status) return null;
  const s = status.state;
  const busy = checking || s === 'checking';
  const line =
    s === 'available'
      ? `Version ${status.latest?.version} ist verfügbar.`
      : s === 'downloading' || s === 'installing'
        ? `Update wird installiert … ${status.progress ?? 0} %`
        : s === 'error'
          ? `Prüfung fehlgeschlagen: ${status.error}`
          : s === 'none'
            ? 'Du hast die neueste Version.'
            : 'Betterfy sucht automatisch alle paar Stunden nach Updates.';

  return (
    <Section title="Über Betterfy" index="09">
      <div className="flex items-center justify-between gap-6 r-tile border border-line bg-white/[0.02] px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="glow relative grid size-10 place-items-center rounded-full border-2 border-accent">
            <div className="size-3 rounded-full bg-accent" />
          </div>
          <div>
            <div className="text-[14px] font-medium">
              Betterfy <span className="font-mono text-[12.5px] text-mute">v{status.current}</span>
            </div>
            <div className={cx('mt-0.5 text-[12.5px]', s === 'available' ? 'text-accent' : s === 'error' ? 'text-red-300' : 'text-mute')}>{line}</div>
          </div>
        </div>
        {s === 'available' || s === 'downloading' || s === 'installing' ? (
          <button onClick={() => setOpen(true)} className="glow flex h-9 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-black">
            <Download className="size-4" /> Update installieren
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={async () => {
              setChecking(true);
              const r = await check().finally(() => setChecking(false));
              if (r.state === 'available') setOpen(true);
            }}
            className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-[12.5px] text-ink transition hover:border-white/25 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Nach Updates suchen
          </button>
        )}
      </div>
    </Section>
  );
}

function WidgetSection() {
  const [w, setW] = useState<WidgetPrefs | null>(null);
  useEffect(() => {
    aura().getWidget().then(setW);
    return aura().on('widget:changed', setW);
  }, []);
  if (!w) return null;
  const update = (patch: Partial<WidgetPrefs>) => aura().setWidget(patch).then((next) => setW(next));
  return (
    <Section title="Desktop-Widget" index="08">
      <div className="divide-y divide-line overflow-hidden r-tile border border-line bg-white/[0.02]">
        <Toggle
          label="Widget auf dem Desktop"
          hint="Kompakter Player als Kachel – bleibt bei Win+D sichtbar. Ziehen zum Verschieben, ⋯ für Optionen."
          value={w.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        <div className={cx('flex items-center justify-between gap-6 px-5 py-4', !w.enabled && 'pointer-events-none opacity-40')}>
          <div>
            <div className="text-[14px] font-medium">Größe</div>
            <div className="mt-0.5 text-[12.5px] text-mute">Mit aktivem Widget läuft Betterfy beim Schließen im Tray weiter.</div>
          </div>
          <Segmented<WidgetPrefs['size']>
            value={w.size}
            onChange={(v) => update({ size: v })}
            options={[
              ['small', 'Klein 2×2'],
              ['medium', 'Mittel 4×2'],
              ['large', 'Groß 4×4'],
            ]}
          />
        </div>
        <WidgetLook w={w} update={update} />
      </div>
    </Section>
  );
}

/** Aussehen des Widgets: Betterfy-Stil oder per Pipette die Farben einer Widget-Notes-Kachel übernehmen. */
function WidgetLook({ w, update }: { w: WidgetPrefs; update: (p: Partial<WidgetPrefs>) => Promise<void> }) {
  const [styles, setStyles] = useState<NotesStyle[] | null>(null);
  const [picking, setPicking] = useState(false);
  const cur = w.style?.mode === 'notes' ? w.style : null;
  const same = (s: NotesStyle) => cur && JSON.stringify([cur.stops, cur.accent, cur.opacity, cur.radius]) === JSON.stringify([s.stops, s.accent, s.opacity, s.radius]);

  const pick = async () => {
    setPicking(true);
    setStyles(await aura().notesStyles());
  };

  const swatch = (s: NotesStyle) => ({
    background: `linear-gradient(135deg, ${s.stops.map((c) => `color-mix(in srgb, ${c} ${Math.round(s.opacity * 100)}%, transparent)`).join(', ')})`,
    borderRadius: Math.min(s.radius, 18),
  });

  return (
    <div className={cx('px-5 py-4', !w.enabled && 'pointer-events-none opacity-40')}>
      <div className="flex items-center justify-between gap-6">
        <div>
          <div className="text-[14px] font-medium">Aussehen</div>
          <div className="mt-0.5 text-[12.5px] text-mute">Passend zu Betterfy – oder per Pipette wie deine Notiz-Kacheln.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => update({ style: { mode: 'betterfy' } })}
            className={cx(
              'h-9 rounded-full border px-4 text-[12.5px] font-medium transition-colors',
              !cur ? 'border-accent/60 bg-accent/10 text-ink' : 'border-line text-mute hover:text-ink',
            )}
          >
            Betterfy
          </button>
          <button
            onClick={pick}
            className={cx(
              'flex h-9 items-center gap-2 rounded-full border px-4 text-[12.5px] font-medium transition-colors',
              cur ? 'border-accent/60 bg-accent/10 text-ink' : 'border-line text-mute hover:text-ink',
            )}
          >
            <Pipette className="size-3.5" /> Von Widget Notes
          </button>
        </div>
      </div>

      {picking && styles && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          {styles.length === 0 ? (
            <p className="text-[12.5px] text-mute">Keine Notiz-Kacheln gefunden (%APPDATA%\WidgetNotes\notes.json).</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {styles.map((s, i) => (
                <button
                  key={i}
                  onClick={() => update({ style: { mode: 'notes', ...s } })}
                  className={cx('group w-36 rounded-xl border p-2 text-left transition-colors', same(s) ? 'border-accent/70' : 'border-line hover:border-white/20')}
                >
                  <div className="relative h-16 border border-white/10 [background-color:#2a2d33] bg-[conic-gradient(#3a3d44_25%,#2a2d33_0_50%,#3a3d44_0_75%,#2a2d33_0)] bg-[length:12px_12px]">
                    <div className="absolute inset-0" style={swatch(s)} />
                    <span className="absolute bottom-2 left-2 size-3 rounded-full" style={{ background: s.accent, boxShadow: `0 0 10px ${s.accent}` }} />
                  </div>
                  <div className="mt-1.5 truncate text-[12px] text-mute">{s.title}</div>
                  <div className="font-mono text-[10px] text-faint">
                    {Math.round(s.opacity * 100)}% · r{s.radius}
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function Section({ title, index, children }: { title: string; index: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center gap-3">
        <span className="hud text-accent">{index}</span>
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        <span className="h-px flex-1 bg-line" />
      </div>
      {children}
    </section>
  );
}

/** Mini-Vorschau eines Hintergrunds: rendert die echten Ebenen in Originalgröße und skaliert sie herunter. */
function Preview({
  mode,
  src,
  accent,
  active,
  radius,
  children,
}: {
  mode: Background;
  src?: string;
  accent?: string;
  active?: boolean;
  radius: number;
  children?: ReactNode;
}) {
  const vars = accent && accent !== 'cover' ? ({ '--accent': accent, '--glow': `color-mix(in oklab, ${accent} 36%, #0a0b0f)`, '--base': `color-mix(in oklab, ${accent} 9%, #07080b)` } as React.CSSProperties) : undefined;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cx(
        'relative aspect-[16/10] overflow-hidden border transition-colors',
        active ? 'border-accent/80' : 'border-line group-hover:border-white/20',
      )}
      style={{ borderRadius: Math.max(6, radius * 0.6), ...vars }}
    >
      <div className="absolute left-0 top-0 h-[1000px] w-[1600px] origin-top-left scale-[0.15]">
        <BackdropLayers mode={mode} src={src} />
      </div>
      {/* Mini-UI-Andeutung */}
      <div className="absolute inset-[10%] flex gap-[5%]">
        <div className="w-[22%] rounded-[4px] border border-white/10 bg-white/[0.06]" />
        <div className="flex-1 rounded-[4px] border border-white/10 bg-black/25" />
      </div>
      <div className="absolute bottom-[14%] left-1/2 h-[9%] w-[34%] -translate-x-1/2 rounded-full border border-white/10 bg-black/40">
        <div className="absolute left-[8%] top-1/2 size-[46%] -translate-y-1/2 rounded-full" style={{ background: 'var(--accent)' }} />
      </div>
      {children && <div className="absolute left-3 top-2.5">{children}</div>}
      {active && (
        <div className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-accent text-black">
          <Check className="size-3" strokeWidth={3} />
        </div>
      )}
    </motion.div>
  );
}

function Range({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] text-mute">{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-ink">
          {value}
          <span className="text-faint">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider accent w-full"
        style={{ ['--pct' as string]: `${pct}%` }}
      />
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="relative inline-flex rounded-full border border-line bg-white/[0.03] p-1">
      {options.map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cx('relative z-10 h-8 rounded-full px-4 text-[13px] font-medium transition-colors', value === id ? 'text-black' : 'text-mute hover:text-ink')}
        >
          {value === id && (
            <motion.span layoutId="seg-pill" className="glow absolute inset-0 -z-10 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
          )}
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-6 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] disabled:opacity-40"
    >
      <div>
        <div className="text-[14px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12.5px] text-mute">{hint}</div>}
      </div>
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors', value ? 'glow bg-accent' : 'bg-white/15')}>
        <motion.span
          animate={{ x: value ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          className="absolute top-[3px] block size-[18px] rounded-full bg-white shadow"
          style={{ left: 0, background: value ? '#0a0b0e' : 'white' }}
        />
      </span>
    </button>
  );
}
