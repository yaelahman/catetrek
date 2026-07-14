"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/format";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "catetrek_pwa_dismiss";

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setStandalone(isStandalone);
    if (isStandalone) return;

    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (standalone || !visible || !deferred) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
    if (outcome === "dismissed") localStorage.setItem(DISMISS_KEY, "1");
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md animate-[toastIn_0.4s_cubic-bezier(0.22,1,0.36,1)]",
        "rounded-2xl border border-[var(--line)] bg-white p-3.5 shadow-[var(--shadow)] dark:bg-[var(--bg-elevated)]"
      )}
      role="dialog"
      aria-label="Pasang Catetrek"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--brand)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--ink)]" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            Pasang Catetrek
          </p>
          <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">
            Tambahkan ke layar utama HP agar cepat dibuka seperti aplikasi.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void install()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110"
            >
              <Download size={14} /> Pasang
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--brand-soft)]"
            >
              Nanti
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
          aria-label="Tutup"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
