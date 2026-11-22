import { aura } from '../lib/bridge';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { cx } from '../lib/format';

export function Login({ onDone }: { onDone: () => void }) {
  const [clientId, setClientId] = useState(import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '');
  const [redirectUri, setRedirectUri] = useState('http://127.0.0.1:8888/callback');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    aura().getConfig().then((c) => {
      if (c.clientId) setClientId(c.clientId);
      setRedirectUri(c.redirectUri);
    });
  }, []);

  const valid = /^[0-9a-f]{32}$/i.test(clientId.trim());

  const login = async () => {
    setBusy(true);
    setError('');
    try {
      await aura().login(clientId.trim());
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid h-full place-items-center overflow-hidden">
      <div className="drag absolute inset-x-0 top-0 h-[52px]" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[8%] size-[520px] rounded-full bg-[#3b7a57] opacity-50 blur-[140px]" />
        <div className="absolute bottom-[0%] right-[8%] size-[460px] rounded-full bg-[#5b4bb7] opacity-40 blur-[140px]" />
        <div className="noise absolute inset-0 opacity-[0.06] mix-blend-overlay" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
        className="glass-dark relative w-[min(520px,calc(100%-48px))] rounded-[28px] p-9"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="size-9 rounded-full bg-gradient-to-br from-[#86d6a0] to-[#5b4bb7] shadow-[0_0_30px_#86d6a088]" />
          <div>
            <h1 className="text-[28px] font-extrabold leading-none tracking-tight">Betterfy</h1>
            <p className="mt-1 text-[13px] text-mute">Deine Musik. Dein Look.</p>
          </div>
        </div>

        <ol className="space-y-4 text-[13.5px] leading-relaxed text-mute">
          <li>
            <span className="font-semibold text-ink">1.</span> Erstelle eine App im{' '}
            <button
              onClick={() => aura().openExternal('https://developer.spotify.com/dashboard')}
              className="inline-flex items-center gap-1 font-medium text-[#86d6a0] hover:underline"
            >
              Spotify Developer Dashboard <ExternalLink className="size-3.5" />
            </button>
            . Wähle <span className="text-ink">Web API</span> und <span className="text-ink">Web Playback SDK</span>.
          </li>
          <li>
            <span className="font-semibold text-ink">2.</span> Trage diese Redirect URI ein:
            <button
              onClick={() => {
                navigator.clipboard.writeText(redirectUri);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="mt-2 flex w-full items-center justify-between rounded-xl bg-white/[0.06] px-3.5 py-2.5 font-mono text-[12.5px] text-ink hover:bg-white/10"
            >
              {redirectUri}
              {copied ? <Check className="size-4 text-[#86d6a0]" /> : <Copy className="size-4 text-mute" />}
            </button>
          </li>
          <li>
            <span className="font-semibold text-ink">3.</span> Kopiere die <span className="text-ink">Client ID</span> hierher:
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="z. B. 3f9a…"
              spellCheck={false}
              className="mt-2 w-full rounded-xl bg-white/[0.06] px-3.5 py-2.5 font-mono text-[13px] text-ink outline-none ring-1 ring-transparent placeholder:text-faint focus:ring-white/25"
            />
          </li>
        </ol>

        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300">{error}</p>}

        <button
          disabled={!valid || busy}
          onClick={login}
          className={cx(
            'mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold transition-all',
            valid && !busy ? 'bg-[#86d6a0] text-black hover:scale-[1.02] active:scale-[0.98]' : 'bg-white/10 text-faint',
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Warte auf den Browser …
            </>
          ) : (
            'Mit Spotify anmelden'
          )}
        </button>
        {busy && (
          <button onClick={() => aura().cancelLogin()} className="mx-auto mt-3 block text-[12px] text-mute hover:text-ink">
            Abbrechen
          </button>
        )}
        <p className="mt-5 text-center text-[11px] text-faint">Musik und Daten werden von Spotify bereitgestellt. Wiedergabe erfordert Spotify Premium.</p>
      </motion.div>
    </div>
  );
}
