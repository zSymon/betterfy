// Geführter Dialog, wenn die Wiedergabe in Betterfy selbst nicht klappt (Kopierschutz/Widevine).
// Erklärt das Problem und bietet Lösungen per Klick – ohne Terminal.
import { Check, Download, ExternalLink, Laptop, Loader2, ShieldAlert, Smartphone, Speaker, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { aura } from '../lib/bridge';
import { cx } from '../lib/format';
import { usePlayer } from '../state/player';
import { useUi } from '../state/ui';

const RELEASES = 'https://github.com/zSymon/betterfy/releases/latest';

export function PlaybackHelp() {
  const { help, setHelp } = useUi();
  const { devices, refreshDevices, transfer, sdk, state } = usePlayer();

  useEffect(() => {
    if (!help) return;
    refreshDevices();
    const t = setInterval(refreshDevices, 3000);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setHelp(false);
    window.addEventListener('keydown', esc);
    return () => {
      clearInterval(t);
      window.removeEventListener('keydown', esc);
    };
  }, [help, refreshDevices, setHelp]);

  const others = devices.filter((d) => d.id && d.id !== sdk.deviceId);
  const activeElsewhere = state?.device?.is_active && state.device.id !== sdk.deviceId;

  return (
    <AnimatePresence>
      {help && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/55 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && setHelp(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="glass-dark r-panel relative w-[min(560px,calc(100%-48px))] p-7"
          >
            <button onClick={() => setHelp(false)} aria-label="Schließen" className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-mute hover:bg-white/10 hover:text-ink">
              <X className="size-4" />
            </button>

            <div className="flex items-start gap-4">
              <div className="glow grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <div className="hud">Wiedergabe</div>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Musik bricht nach ein paar Sekunden ab?</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-mute">
                  Spotify schützt Songs mit einem Kopierschutz. Diese Betterfy-Version bekommt dafür keine Freigabe – meist, weil sie veraltet
                  oder nicht offiziell gebaut ist. Du hast zwei Möglichkeiten:
                </p>
              </div>
            </div>

            {/* Weg 1: aktuelle Version */}
            <Step n={1} title="Aktuelle Betterfy-Version installieren" hint="Die offiziellen Versionen sind freigeschaltet und spielen direkt in der App.">
              <button
                onClick={() => aura().openExternal(RELEASES)}
                className="glow mt-3 flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[13px] font-semibold text-black transition hover:scale-[1.02]"
              >
                <Download className="size-4" /> Neueste Version herunterladen
                <ExternalLink className="size-3.5 opacity-60" />
              </button>
            </Step>

            {/* Weg 2: anderes Gerät */}
            <Step n={2} title="Über ein anderes Gerät abspielen" hint="Betterfy steuert dann z. B. die Spotify-App im Hintergrund oder dein Handy – mit allen Funktionen.">
              <ol className="mt-3 space-y-2 text-[13px] text-mute">
                <li className="flex items-center gap-2">
                  <span className="hud !text-accent">a</span>
                  Öffne Spotify auf dem PC oder Handy und starte kurz einen Song.
                  <button onClick={() => aura().openExternal('spotify:')} className="ml-auto shrink-0 rounded-full border border-line px-3 py-1 text-[12px] text-ink hover:border-white/25">
                    Spotify öffnen
                  </button>
                </li>
                <li className="flex items-center gap-2">
                  <span className="hud !text-accent">b</span>
                  Wähle das Gerät hier aus:
                </li>
              </ol>
              <div className="mt-2 space-y-1.5">
                {others.length === 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-[12.5px] text-faint">
                    <Loader2 className="size-3.5 animate-spin" /> Suche nach Geräten …
                  </div>
                )}
                {others.map((d) => {
                  const Icon = /phone|tablet/i.test(d.type) ? Smartphone : /speaker|avr|tv|cast/i.test(d.type) ? Speaker : Laptop;
                  return (
                    <button
                      key={d.id}
                      onClick={() => d.id && transfer(d.id)}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors',
                        d.is_active ? 'border-accent/50 bg-accent/10' : 'border-line hover:border-white/20',
                      )}
                    >
                      <Icon className={cx('size-4', d.is_active ? 'text-accent' : 'text-mute')} />
                      <span className="flex-1 truncate text-[13.5px] font-medium">{d.name}</span>
                      {d.is_active ? <Check className="size-4 text-accent" /> : <span className="text-[12px] text-faint">Hier abspielen</span>}
                    </button>
                  );
                })}
              </div>
            </Step>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-[12px] text-faint">{activeElsewhere ? `✓ Spielt jetzt auf ${state?.device.name}` : ''}</span>
              <button onClick={() => setHelp(false)} className="rounded-full border border-line px-4 py-2 text-[13px] text-ink hover:border-white/25">
                {activeElsewhere ? 'Fertig' : 'Schließen'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex items-baseline gap-3">
        <span className="hud !text-accent">0{n}</span>
        <div>
          <div className="text-[15px] font-semibold tracking-tight">{title}</div>
          <div className="mt-0.5 text-[12.5px] text-mute">{hint}</div>
        </div>
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}
