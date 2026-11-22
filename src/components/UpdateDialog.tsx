// Dialog „Neue Version verfügbar“: Änderungen anzeigen, laden, still installieren, neu starten.
import { ArrowRight, Download, ExternalLink, Loader2, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { aura } from '../lib/bridge';
import { useUpdate } from '../state/update';

const RELEASES = 'https://github.com/zSymon/betterfy/releases/latest';

export function UpdateDialog() {
  const { status, install, open, setOpen } = useUpdate();
  const busy = status?.state === 'downloading' || status?.state === 'installing';

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !busy && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open, busy, setOpen]);

  const latest = status?.latest;

  return (
    <AnimatePresence>
      {open && status && latest && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/55 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && !busy && setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="glass-dark r-panel relative w-[min(520px,calc(100%-48px))] p-7"
          >
            {!busy && (
              <button onClick={() => setOpen(false)} aria-label="Schließen" className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-mute hover:bg-white/10 hover:text-ink">
                <X className="size-4" />
              </button>
            )}

            <div className="flex items-start gap-4">
              <div className="glow grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                <Sparkles className="size-5" />
              </div>
              <div>
                <div className="hud">Update</div>
                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Betterfy {latest.version} ist da</h2>
                <div className="mt-2 flex items-center gap-2 font-mono text-[12px] text-faint">
                  v{status.current} <ArrowRight className="size-3.5" /> <span className="text-accent">v{latest.version}</span>
                </div>
              </div>
            </div>

            {latest.notes.trim() && (
              <div className="scroll mt-6 max-h-[38vh] border-t border-line pt-5 text-[13.5px] leading-relaxed text-mute">
                <Notes text={latest.notes} />
              </div>
            )}

            {status.state === 'error' && <p className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-[12.5px] text-red-200">{status.error}</p>}

            <div className="mt-7">
              {busy ? (
                <div>
                  <div className="flex items-center justify-between text-[12.5px] text-mute">
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      {status.state === 'installing' ? 'Wird installiert – Betterfy startet gleich neu …' : 'Wird heruntergeladen …'}
                    </span>
                    <span className="font-mono tabular-nums">{status.progress ?? 0} %</span>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div className="glow h-full rounded-full bg-accent" animate={{ width: `${status.progress ?? 0}%` }} transition={{ ease: 'linear', duration: 0.2 }} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => aura().openExternal(latest.page || RELEASES)} className="flex items-center gap-1.5 text-[12.5px] text-faint hover:text-ink">
                    Auf GitHub ansehen <ExternalLink className="size-3" />
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setOpen(false)} className="rounded-full border border-line px-4 py-2 text-[13px] text-ink hover:border-white/25">
                      Später
                    </button>
                    {status.canInstall ? (
                      <button
                        onClick={install}
                        className="glow flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[13px] font-semibold text-black transition hover:scale-[1.02]"
                      >
                        <Download className="size-4" /> Jetzt installieren
                      </button>
                    ) : (
                      <button
                        onClick={() => aura().openExternal(latest.page || RELEASES)}
                        className="glow flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[13px] font-semibold text-black"
                      >
                        <Download className="size-4" /> Herunterladen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Mini-Markdown für Release-Notizen: Überschriften, Listen, **fett**, `code`, Links. */
function Notes({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={out.length} className="mb-3 space-y-1.5">{list}</ul>);
    list = [];
  };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return flush();
    if (/^#{1,6}\s/.test(line)) {
      flush();
      out.push(
        <div key={`h${i}`} className="mb-2 mt-1 text-[13px] font-semibold text-ink">
          {inline(line.replace(/^#+\s*/, ''))}
        </div>,
      );
    } else if (/^[-*]\s/.test(line)) {
      list.push(
        <li key={i} className="flex gap-2.5">
          <span className="mt-[9px] size-1 shrink-0 rounded-full bg-accent" />
          <span>{inline(line.slice(2))}</span>
        </li>,
      );
    } else if (line.startsWith('>')) {
      flush();
      out.push(<p key={`q${i}`} className="mb-3 border-l-2 border-line pl-3 text-faint">{inline(line.replace(/^>\s*/, ''))}</p>);
    } else {
      flush();
      out.push(<p key={`p${i}`} className="mb-3">{inline(line)}</p>);
    }
  });
  flush();
  return <>{out}</>;
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (/^`.+`$/.test(part)) return <code key={i} className="rounded bg-white/10 px-1 font-mono text-[12px]">{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link)
      return (
        <button key={i} onClick={() => aura().openExternal(link[2])} className="text-accent underline-offset-2 hover:underline">
          {link[1]}
        </button>
      );
    return part.replace(/\*/g, '');
  });
}
