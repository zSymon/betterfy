// Update-Status aus dem Hauptprozess (GitHub-Releases) + Dialog-Steuerung.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { aura } from '../lib/bridge';

type UpdateCtx = {
  status: UpdateStatus | null;
  check(): Promise<UpdateStatus>;
  install(): Promise<void>;
  open: boolean;
  setOpen(v: boolean): void;
};

const Ctx = createContext<UpdateCtx | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).has('updatedialog'));

  useEffect(() => {
    aura().getUpdate().then(setStatus);
    return aura().on('update:status', setStatus);
  }, []);

  const check = useCallback(async () => {
    const s = await aura().checkUpdate();
    setStatus(s);
    return s;
  }, []);
  const install = useCallback(async () => {
    setStatus(await aura().installUpdate());
  }, []);

  const value = useMemo(() => ({ status, check, install, open, setOpen }), [status, check, install, open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUpdate() {
  const c = useContext(Ctx);
  if (!c) throw new Error('UpdateProvider fehlt');
  return c;
}
