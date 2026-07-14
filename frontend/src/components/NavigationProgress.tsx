"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/** Progress bar tipis di atas saat pindah halaman. */
export function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef<number | null>(null);
  const prevPath = useRef(pathname);

  const clearTimers = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (doneRef.current) window.clearTimeout(doneRef.current);
    timerRef.current = null;
    doneRef.current = null;
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setVisible(true);
    setWidth(14);
    timerRef.current = window.setInterval(() => {
      setWidth((w) => {
        if (w >= 88) return w;
        const step = w < 40 ? 10 : w < 70 ? 4 : 1.5;
        return Math.min(88, w + step);
      });
    }, 160);
  }, [clearTimers]);

  const finish = useCallback(() => {
    clearTimers();
    setWidth(100);
    doneRef.current = window.setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 220);
  }, [clearTimers]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
      } catch {
        return;
      }

      start();
    };

    const onPopState = () => start();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, [start, clearTimers]);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      finish();
    }
  }, [pathname, finish]);

  if (!visible) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100]" style={{ height: 3 }}>
      <div
        className="h-full origin-left rounded-r-full transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${width}%`,
          opacity: 1,
          background: "linear-gradient(90deg, var(--brand), var(--brand-mid), var(--accent))",
          boxShadow: "0 0 12px color-mix(in srgb, var(--brand) 45%, transparent)",
        }}
      />
    </div>
  );
}
