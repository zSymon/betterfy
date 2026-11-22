import { useCallback, useEffect, useRef, useState } from 'react';
import type { Paging } from './types';

/** Lädt eine Paging-Liste schrittweise nach, sobald das Sentinel-Element sichtbar wird. */
export function usePaged<T>(loader: (offset: number) => Promise<Paging<T>>, key: string, enabled = true) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const offset = useRef(0);
  const done = useRef(false);
  const gen = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const more = useCallback(async () => {
    if (busy.current || done.current || !enabled) return;
    busy.current = true;
    setLoading(true);
    const g = gen.current;
    try {
      const page = await loaderRef.current(offset.current);
      if (g !== gen.current) return;
      offset.current += page.items.length;
      done.current = !page.next || page.items.length === 0;
      setItems((prev) => [...prev, ...page.items]);
      setTotal(page.total);
    } catch (e) {
      if (g === gen.current) {
        setError(e);
        done.current = true;
      }
    } finally {
      if (g === gen.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    gen.current++;
    busy.current = false;
    offset.current = 0;
    done.current = false;
    setItems([]);
    setTotal(null);
    setError(null);
    if (enabled) more();
  }, [key, enabled, more]);

  const observer = useRef<IntersectionObserver | null>(null);
  const sentinel = useCallback(
    (el: HTMLElement | null) => {
      observer.current?.disconnect();
      if (!el) return;
      observer.current = new IntersectionObserver((e) => e[0].isIntersecting && more(), { rootMargin: '800px' });
      observer.current.observe(el);
    },
    [more],
  );

  return { items, total, error, loading, sentinel, hasMore: !done.current };
}
