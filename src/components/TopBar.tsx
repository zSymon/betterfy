import { ChevronLeft, ChevronRight, House, LogOut, Palette, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cx, pickImage } from '../lib/format';
import { useAsync, useClickOutside } from '../lib/hooks';
import * as sp from '../lib/spotify';
import { useUi } from '../state/ui';
import { Cover, IconButton } from './ui';

export function TopBar({ onLogout }: { onLogout: () => void }) {
  const { route, navigate, replace, back, forward, canBack, canForward } = useUi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(route.name === 'search' ? (route.q ?? '') : '');
  const { data: user } = useAsync(() => sp.me(), []);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenu(false), menu);

  useEffect(() => {
    if (route.name !== 'search') setQ('');
    else if ((route.q ?? '') !== q) setQ(route.q ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Strg+K → Suche
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const onChange = (v: string) => {
    setQ(v);
    if (route.name === 'search') replace({ name: 'search', q: v });
    else navigate({ name: 'search', q: v });
  };

  return (
    <header className="drag relative z-20 flex h-[52px] shrink-0 items-center gap-2 pl-3 pr-[150px]">
      <div className="flex items-center gap-2">
        <div className="mr-2 flex items-center gap-2 pl-1">
          <div className="glow relative grid size-[18px] place-items-center rounded-full border-[1.5px] border-accent">
            <div className="size-[6px] rounded-full bg-accent" />
          </div>
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.28em]">Betterfy</span>
        </div>
        <div className="flex rounded-full border border-line">
          <IconButton label="Zurück" size="sm" disabled={!canBack} onClick={back}>
            <ChevronLeft className="size-[18px]" />
          </IconButton>
          <IconButton label="Vor" size="sm" disabled={!canForward} onClick={forward}>
            <ChevronRight className="size-[18px]" />
          </IconButton>
        </div>
      </div>

      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
        <button
          onClick={() => navigate({ name: 'home' })}
          aria-label="Startseite"
          className={cx(
            'grid size-10 place-items-center rounded-full border transition-colors',
            route.name === 'home' ? 'border-white/20 bg-white/10 text-ink' : 'border-line text-mute hover:border-white/15 hover:text-ink',
          )}
        >
          <House className="size-[18px]" />
        </button>
        <label
          className={cx(
            'flex h-10 w-[min(420px,34vw)] items-center gap-2.5 rounded-full border px-4 transition-all',
            route.name === 'search' ? 'border-accent/50 bg-white/[0.06]' : 'border-line hover:border-white/15',
          )}
        >
          <Search className="size-[17px] shrink-0 text-mute" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => route.name !== 'search' && navigate({ name: 'search', q })}
            onKeyDown={(e) => e.key === 'Escape' && (e.currentTarget.blur(), onChange(''))}
            placeholder="Was willst du hören?"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
          {q ? (
            <button onClick={() => onChange('')} aria-label="Leeren" className="text-mute hover:text-ink">
              <X className="size-4" />
            </button>
          ) : (
            <kbd className="whitespace-nowrap rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">Strg K</kbd>
          )}
        </label>
      </div>

      <div ref={menuRef} className="relative ml-auto flex items-center gap-2">
        <button
          onClick={() => navigate({ name: 'design' })}
          title="Design"
          className={cx(
            'flex h-9 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors',
            route.name === 'design' ? 'border-accent/60 text-accent' : 'border-line text-mute hover:border-white/15 hover:text-ink',
          )}
        >
          <Palette className="size-4" />
          Design
        </button>
        <button onClick={() => setMenu((v) => !v)} className="block rounded-full ring-2 ring-white/10 transition hover:ring-white/30" aria-label="Konto">
          <Cover src={pickImage(user?.images, 64)} round className="size-8" />
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.14 }}
              className="glass-dark absolute right-0 top-11 z-50 w-56 origin-top-right rounded-xl p-1.5"
            >
              <div className="truncate px-3 py-2 text-[13px] font-semibold">{user?.display_name ?? 'Konto'}</div>
              <button
                onClick={() => {
                  setMenu(false);
                  navigate({ name: 'design' });
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-white/10"
              >
                <Palette className="size-4 text-mute" /> Design anpassen
              </button>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-white/10"
              >
                <LogOut className="size-4 text-mute" /> Abmelden
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
