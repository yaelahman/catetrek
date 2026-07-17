"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, Trash2, X } from "lucide-react";
import { cn } from "@/lib/format";

export type ConfirmTone = "danger" | "warning" | "brand";
export type ToastTone = "success" | "danger" | "info" | "warning";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
};

export type ToastOptions = {
  title?: string;
  message: string;
  tone?: ToastTone;
  duration?: number;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ToastItem = ToastOptions & { id: string };

type AlertApi = {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  toast: (options: ToastOptions | string) => void;
};

const AlertContext = createContext<AlertApi | null>(null);

let confirmBridge: AlertApi["confirm"] = async () => false;
let toastBridge: AlertApi["toast"] = () => {};

/** Imperative confirm — ganti window.confirm */
export function confirm(options: ConfirmOptions | string) {
  return confirmBridge(options);
}

/** Imperative toast — ganti window.alert */
export function toast(options: ToastOptions | string) {
  return toastBridge(options);
}

function normalizeConfirm(options: ConfirmOptions | string): ConfirmOptions {
  if (typeof options === "string") return { title: options, tone: "warning" };
  return { tone: "warning", confirmText: "Ya, lanjutkan", cancelText: "Batal", ...options };
}

function normalizeToast(options: ToastOptions | string): ToastOptions {
  if (typeof options === "string") return { message: options, tone: "info" };
  return { tone: "info", duration: 3800, ...options };
}

const toneMeta: Record<ConfirmTone, { icon: typeof Trash2; soft: string; label: string }> = {
  danger: {
    icon: Trash2,
    soft: "bg-orange-100 text-[var(--danger)] dark:bg-orange-500/20",
    label: "Perhatian",
  },
  warning: {
    icon: AlertTriangle,
    soft: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    label: "Konfirmasi",
  },
  brand: {
    icon: Info,
    soft: "bg-[var(--brand-soft)] text-[var(--brand)]",
    label: "Konfirmasi",
  },
};

const toastMeta: Record<ToastTone, { icon: typeof CheckCircle2; soft: string }> = {
  success: {
    icon: CheckCircle2,
    soft: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  danger: {
    icon: AlertTriangle,
    soft: "bg-orange-100 text-[var(--danger)] dark:bg-orange-500/20",
  },
  warning: {
    icon: AlertTriangle,
    soft: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
  info: {
    icon: Info,
    soft: "bg-[var(--brand-soft)] text-[var(--brand)]",
  },
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [visible, setVisible] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  const closeConfirm = useCallback(
    (value: boolean) => {
      if (!confirmState || closingRef.current) return;
      closingRef.current = true;
      setVisible(false);
      window.setTimeout(() => {
        confirmState.resolve(value);
        setConfirmState(null);
        closingRef.current = false;
      }, 200);
    },
    [confirmState]
  );

  const api = useMemo<AlertApi>(
    () => ({
      confirm: (options) =>
        new Promise<boolean>((resolve) => {
          setConfirmState({ ...normalizeConfirm(options), resolve });
          requestAnimationFrame(() => setVisible(true));
        }),
      toast: (options) => {
        const item = { ...normalizeToast(options), id: `${Date.now()}-${Math.random()}` };
        setToasts((prev) => [...prev.slice(-4), item]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== item.id));
        }, item.duration ?? 3800);
      },
    }),
    []
  );

  useEffect(() => {
    confirmBridge = api.confirm;
    toastBridge = api.toast;
  }, [api]);

  useEffect(() => {
    if (!confirmState) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmState, closeConfirm]);

  const tone = confirmState?.tone || "warning";
  const meta = toneMeta[tone];
  const Icon = meta.icon;

  return (
    <AlertContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <>
            {confirmState && (
              <div
                className="fixed inset-0 z-[80] flex items-center justify-center p-4"
                style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 transition-opacity duration-200",
                    visible ? "opacity-100" : "opacity-0"
                  )}
                  style={{ background: "rgba(16, 24, 22, 0.5)", backdropFilter: "blur(10px)" }}
                />
                <div
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="catetrek-confirm-title"
                  className={cn(
                    "relative z-10 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[1.6rem] border border-[var(--line)] bg-white transition-all duration-300 ease-out dark:bg-[var(--bg-elevated)]",
                    visible
                      ? "translate-y-0 scale-100 opacity-100"
                      : "translate-y-3 scale-[0.96] opacity-0"
                  )}
                  style={{
                    width: "min(100%, 22rem)",
                    maxWidth: "22rem",
                    boxShadow: "0 24px 64px -24px rgba(6, 53, 47, 0.5)",
                  }}
                >
                  <div className="px-6 pb-6 pt-8 text-center">
                    <div
                      className={cn(
                        "mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full",
                        meta.soft
                      )}
                      style={{ animation: "popIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)" }}
                    >
                      <Icon size={24} strokeWidth={2} />
                    </div>

                    <p
                      className="mb-1.5 font-semibold uppercase text-[var(--muted)]"
                      style={{ fontSize: "0.68rem", letterSpacing: "0.18em" }}
                    >
                      {meta.label}
                    </p>
                    <h2
                      id="catetrek-confirm-title"
                      className="font-bold leading-snug tracking-tight text-[var(--ink)]"
                      style={{ fontSize: "1.15rem", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                    >
                      {confirmState.title}
                    </h2>
                    {confirmState.message && (
                      <p
                        className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]"
                        style={{ maxWidth: "17.5rem", marginLeft: "auto", marginRight: "auto" }}
                      >
                        {confirmState.message}
                      </p>
                    )}

                    <div
                      className="mt-7 grid gap-2.5"
                      style={{ gridTemplateColumns: "1fr 1fr" }}
                    >
                      <button
                        type="button"
                        onClick={() => closeConfirm(false)}
                        className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--bg)] active:scale-[0.98] dark:bg-[var(--bg-elevated)]"
                      >
                        {confirmState.cancelText || "Batal"}
                      </button>
                      <button
                        type="button"
                        onClick={() => closeConfirm(true)}
                        className="rounded-xl px-3 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
                        style={{
                          background:
                            tone === "danger"
                              ? "var(--danger)"
                              : tone === "brand"
                                ? "var(--brand)"
                                : "#d97706",
                        }}
                      >
                        {confirmState.confirmText || "Ya, lanjutkan"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex flex-col items-end gap-2.5 p-4 sm:p-5">
              {toasts.map((t) => {
                const tm = toastMeta[t.tone || "info"];
                const TIcon = tm.icon;
                return (
                  <div
                    key={t.id}
                    className="pointer-events-auto animate-[toastIn_0.4s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl border border-[var(--line)] bg-white dark:bg-[var(--bg-elevated)]"
                    style={{
                      width: "min(100%, 24rem)",
                      maxWidth: "24rem",
                      boxShadow: "0 16px 40px -18px rgba(6, 53, 47, 0.35)",
                    }}
                  >
                    <div className="flex items-start gap-3 p-3.5">
                      <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl", tm.soft)}>
                        <TIcon size={18} />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        {t.title && (
                          <p
                            className="text-sm font-semibold text-[var(--ink)]"
                            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                          >
                            {t.title}
                          </p>
                        )}
                        <p className={cn("text-sm leading-snug text-[var(--muted)]", t.title && "mt-0.5")}>
                          {t.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg p-1 text-[var(--muted)] transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
                        onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                        aria-label="Tutup"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within AlertProvider");
  return ctx;
}
