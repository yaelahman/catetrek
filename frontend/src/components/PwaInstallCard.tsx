"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button, Card } from "@/components/ui";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setInstalled(isStandalone);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferred(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Smartphone size={18} />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Pasang sebagai aplikasi</h2>
          <p className="text-sm text-[var(--muted)]">
            Buka Catetrek dari layar utama Android seperti aplikasi native.
          </p>
        </div>
      </div>

      {installed ? (
        <p className="rounded-xl bg-[var(--brand-soft)] px-3 py-2.5 text-sm text-[var(--brand)]">
          Catetrek sudah terpasang di perangkat ini.
        </p>
      ) : deferred ? (
        <Button onClick={() => void install()} disabled={busy}>
          <Download size={16} /> {busy ? "Memasang..." : "Pasang sekarang"}
        </Button>
      ) : (
        <ol className="space-y-2 text-sm text-[var(--muted)]">
          <li>
            <span className="font-semibold text-[var(--ink)]">Android (Chrome):</span> menu ⋮ →{" "}
            <strong>Install app</strong> / <strong>Add to Home screen</strong>.
          </li>
          <li>
            <span className="font-semibold text-[var(--ink)]">Produksi:</span> domain harus HTTPS. Di
            development, gunakan build production atau tunnel (ngrok).
          </li>
        </ol>
      )}
    </Card>
  );
}
