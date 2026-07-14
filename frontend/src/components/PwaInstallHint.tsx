"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Download, Smartphone } from "lucide-react";
import { confirm } from "@/lib/alert";
import { cn } from "@/lib/format";

const HINT_KEY = "catetrek_pwa_hint_done";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

const INSTALL_MESSAGE =
  "Buka di Chrome Android → menu ⋮ → Install app / Add to Home screen.\n\nAtau tunggu banner / tombol di Pengaturan.";

/** Dialog konfirmasi cara pasang PWA. Returns true jika user pilih Ke Pengaturan. */
export async function showPwaInstallConfirm(options?: { force?: boolean }) {
  if (isStandalone()) return false;
  if (!options?.force && localStorage.getItem(HINT_KEY) === "1") return false;

  const goSettings = await confirm({
    title: "Pasang Catetrek di HP",
    message: INSTALL_MESSAGE,
    confirmText: "Ke Pengaturan",
    cancelText: "Mengerti",
    tone: "brand",
  });

  localStorage.setItem(HINT_KEY, "1");
  return goSettings;
}

/** Auto-show sekali di dashboard + tombol di sidebar. */
export function PwaInstallHint({ variant = "sidebar" }: { variant?: "sidebar" | "auto" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setReady(true);
  }, []);

  useEffect(() => {
    if (variant !== "auto" || !ready || installed) return;
    if (!pathname.startsWith("/dashboard")) return;
    if (localStorage.getItem(HINT_KEY) === "1") return;

    const t = window.setTimeout(() => {
      void (async () => {
        const goSettings = await showPwaInstallConfirm();
        if (goSettings) router.push("/settings");
      })();
    }, 900);

    return () => window.clearTimeout(t);
  }, [variant, ready, installed, pathname, router]);

  if (variant === "auto") return null;
  if (!ready || installed) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          const goSettings = await showPwaInstallConfirm({ force: true });
          if (goSettings) router.push("/settings");
        })();
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
        "bg-[var(--accent)]/15 text-white/90 hover:bg-[var(--accent)]/25 hover:text-white"
      )}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
        <Smartphone size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Pasang aplikasi</span>
        <span className="block truncate text-[0.7rem] text-white/55">Tambah ke layar utama</span>
      </span>
      <Download size={14} className="shrink-0 opacity-70" />
    </button>
  );
}
