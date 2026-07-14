"use client";

import {
  Children,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Eye, EyeOff, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/format";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group rounded-[1.35rem] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow)] dark:bg-[var(--bg-elevated)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-fade-up">
        <div className="mb-2 h-1.5 w-12 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--accent)]" />
        <h1 className="text-3xl font-bold text-[var(--ink)] md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-xl text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action && <div className="animate-fade-up" style={{ animationDelay: "0.08s" }}>{action}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary:
      "btn-shine bg-gradient-to-br from-[var(--brand-mid)] to-[var(--brand-deep)] text-white shadow-[0_12px_24px_-12px_color-mix(in_srgb,var(--brand)_70%,transparent)] hover:brightness-110 active:scale-[0.98]",
    secondary:
      "border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--ink)] hover:border-[var(--brand)]/30 hover:bg-[var(--brand-soft)]/60 active:scale-[0.98]",
    danger: "bg-gradient-to-br from-orange-500 to-[var(--danger)] text-white hover:brightness-110 active:scale-[0.98]",
    ghost: "text-[var(--brand)] hover:bg-[var(--brand-soft)] active:scale-[0.98]",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type FieldBaseProps = {
  label: string;
  icon?: ReactNode;
  hint?: string;
  error?: string;
  className?: string;
};

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & FieldBaseProps
>(function Input({ label, icon, hint, error, className, type = "text", value, defaultValue, onChange, ...props }, ref) {
  const id = useId();
  const [showPass, setShowPass] = useState(false);
  const [filled, setFilled] = useState(() => {
    const initial = value ?? defaultValue;
    return initial !== undefined && String(initial).length > 0;
  });
  const isPassword = type === "password";
  const inputType = isPassword ? (showPass ? "text" : "password") : type;

  useEffect(() => {
    if (value !== undefined) setFilled(String(value).length > 0);
  }, [value]);

  return (
    <div className={cn("animate-fade-up", className)}>
      <div
        className={cn(
          "field-shell",
          !icon && "no-icon",
          filled && "has-value",
          error && "has-error",
          type === "color" && "min-h-[3.6rem]"
        )}
      >
        {icon && <span className="field-icon">{icon}</span>}
        <div className="field-body">
          <label htmlFor={id} className="field-label">
            {label}
          </label>
          <input
            id={id}
            ref={ref}
            type={inputType}
            className="field-control"
            value={value}
            defaultValue={defaultValue}
            placeholder=" "
            onChange={(e) => {
              setFilled(e.target.value.length > 0);
              onChange?.(e);
            }}
            onAnimationStart={(e) => {
              // Chrome autofill fires animation; treat as filled
              if (e.animationName === "onAutoFillStart") setFilled(true);
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              setFilled(el.value.length > 0);
            }}
            {...props}
          />
        </div>
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPass((s) => !s)}
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
            aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
});

export const Select = forwardRef<
  HTMLButtonElement,
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "size"> &
    FieldBaseProps & {
      onChange?: (e: { target: { value: string } }) => void;
      variant?: "field" | "filter";
    }
>(function Select({
  label,
  icon,
  hint,
  error,
  className,
  value,
  defaultValue,
  children,
  onChange,
  disabled,
  variant = "field",
  ...props
}, ref) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(String(value ?? defaultValue ?? ""));
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (value !== undefined) setInternal(String(value));
  }, [value]);

  const options = useMemo(() => {
    const list: Array<{ value: string; label: string; disabled?: boolean }> = [];
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) return;
      const optionProps = child.props as {
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
      };
      const optionValue = optionProps.value !== undefined ? String(optionProps.value) : "";
      const optionLabel =
        typeof optionProps.children === "string" || typeof optionProps.children === "number"
          ? String(optionProps.children)
          : optionValue || "Pilih";
      list.push({
        value: optionValue,
        label: optionLabel,
        disabled: optionProps.disabled,
      });
    });
    return list;
  }, [children]);

  const selected = options.find((o) => o.value === internal) || options[0];
  const filled = Boolean(selected && (selected.value !== "" || selected.label));

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > spaceBelow;
    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 200),
      zIndex: 80,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 8, top: "auto" }
        : { top: rect.bottom + 8, bottom: "auto" }),
    });

    // Scroll opsi aktif ke tengah setelah menu render
    requestAnimationFrame(() => {
      const active = menuRef.current?.querySelector('[aria-selected="true"]') as HTMLElement | null;
      active?.scrollIntoView({ block: "nearest" });
    });
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollOrResize(e: Event) {
      // Jangan tutup saat scroll di dalam menu dropdown
      if (e.type === "scroll" && menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
      window.addEventListener("scroll", onScrollOrResize, true);
      window.addEventListener("resize", onScrollOrResize);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  function choose(next: string) {
    setInternal(next);
    onChange?.({ target: { value: next } });
    setOpen(false);
  }

  const isFilter = variant === "filter";

  const menu =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        role="listbox"
        aria-labelledby={id}
        style={menuStyle}
        className="select-menu max-h-[min(20rem,60vh)] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-1.5 shadow-[var(--shadow)] animate-scale-in"
      >
        {options.map((opt) => {
          const active = opt.value === internal;
          return (
            <button
              key={`${opt.value}-${opt.label}`}
              type="button"
              role="option"
              aria-selected={active}
              disabled={opt.disabled}
              onClick={() => choose(opt.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition",
                active
                  ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
                  : "text-[var(--ink)] hover:bg-[var(--brand-soft)]/60",
                opt.disabled && "cursor-not-allowed opacity-40"
              )}
            >
              <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              {active && <Check size={15} className="shrink-0 text-[var(--brand)]" />}
            </button>
          );
        })}
      </div>,
      document.body
    );

  return (
    <div className={cn("animate-fade-up relative", className)} ref={rootRef}>
      {isFilter ? (
        <button
          type="button"
          id={id}
          ref={ref}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={cn(
            "group flex w-full min-h-[3.1rem] items-center gap-3 rounded-[1.05rem] border px-3.5 py-2 text-left transition duration-200",
            "border-[var(--line)] bg-[var(--bg-elevated)] shadow-[var(--shadow-soft)]",
            "hover:-translate-y-0.5 hover:border-[var(--brand)]/35 hover:shadow-[var(--shadow)]",
            open && "border-[var(--brand)] shadow-[0_0_0_4px_rgba(11,95,86,0.12)]",
            error && "border-[var(--danger)]",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {icon ? (
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              {icon}
            </span>
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <ChevronDown size={15} className={cn("transition", open && "rotate-180")} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--brand)]">
              {label}
            </span>
            <span className="block truncate text-sm font-semibold text-[var(--ink)]">
              {selected?.label || "Pilih opsi"}
            </span>
          </span>
          <ChevronDown
            size={16}
            className={cn(
              "shrink-0 text-[var(--muted)] transition duration-200",
              open && "rotate-180 text-[var(--brand)]"
            )}
          />
        </button>
      ) : (
        <button
          type="button"
          id={id}
          ref={ref}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={cn(
            "field-shell w-full cursor-pointer text-left",
            !icon && "no-icon",
            filled && "has-value",
            error && "has-error",
            open && "border-[var(--brand)]",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {icon && <span className="field-icon">{icon}</span>}
          <div className="field-body">
            <span className="field-label">{label}</span>
            <span className="field-control block truncate pr-2">{selected?.label || " "}</span>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "shrink-0 text-[var(--muted)] transition duration-200",
              open && "rotate-180 text-[var(--brand)]"
            )}
          />
        </button>
      )}

      {menu}

      <input type="hidden" name={props.name} value={internal} readOnly />

      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldBaseProps
>(function TextArea({ label, icon, hint, error, className, value, defaultValue, onChange, ...props }, ref) {
  const id = useId();
  const [filled, setFilled] = useState(Boolean(value ?? defaultValue));

  useEffect(() => {
    if (value !== undefined) setFilled(String(value).length > 0);
  }, [value]);

  return (
    <div className={cn("animate-fade-up", className)}>
      <div
        className={cn(
          "field-shell items-start py-3",
          !icon && "no-icon",
          filled && "has-value",
          error && "has-error"
        )}
      >
        {icon && <span className="field-icon mt-1">{icon}</span>}
        <div className="field-body">
          <label htmlFor={id} className="field-label">
            {label}
          </label>
          <textarea
            id={id}
            ref={ref}
            className="field-control"
            value={value}
            defaultValue={defaultValue}
            placeholder=" "
            onChange={(e) => {
              setFilled(e.target.value.length > 0);
              onChange?.(e);
            }}
            {...props}
          />
        </div>
      </div>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
});

/** @deprecated prefer Input/Select label prop — kept for older pages */
export function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-semibold text-[var(--ink)]">{children}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        className="absolute inset-0 animate-fade-in backdrop-blur-[6px]"
        style={{ background: "var(--overlay)" }}
        onClick={onClose}
        aria-label="Tutup"
      />
      <div className="relative z-10 w-full max-w-lg animate-scale-in overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--bg-elevated)] shadow-[var(--shadow)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-[var(--brand)] via-[var(--brand-mid)] to-[var(--accent)]" />
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">Form</p>
              <h2 className="mt-1 text-xl font-bold">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border border-[var(--line)] p-2 text-[var(--muted)] transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
              aria-label="Tutup modal"
            >
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="animate-fade-up rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white px-6 py-14 text-center dark:bg-[var(--bg-elevated)]">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--brand-soft)] shadow-[var(--shadow-soft)]">
        <span className="h-3 w-3 rounded-full bg-[var(--brand)] live-dot" />
      </div>
      <p className="text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{desc}</p>
    </div>
  );
}

export function FileAttach({
  file,
  onChange,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
}) {
  const id = useId();
  const [drag, setDrag] = useState(false);

  return (
    <div className="animate-fade-up">
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      <label
        htmlFor={id}
        className={cn("file-drop", drag && "is-drag", file && "has-file")}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onChange(f);
        }}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--bg-elevated)] text-[var(--brand)] shadow-sm">
          <Paperclip size={18} />
        </span>
        {file ? (
          <>
            <p className="text-sm font-semibold text-[var(--ink)]">{file.name}</p>
            <p className="text-xs">{(file.size / 1024).toFixed(1)} KB · klik untuk ganti</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-[var(--ink)]">Lampirkan bukti transaksi</p>
            <p className="text-xs">JPG, PNG, WEBP, atau PDF · maks 5MB · drag & drop atau klik</p>
          </>
        )}
      </label>
      {file && (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-[var(--danger)] hover:underline"
          onClick={() => onChange(null)}
        >
          Hapus lampiran
        </button>
      )}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
}) {
  const map = {
    neutral: "bg-[var(--brand-soft)] text-[var(--ink)]",
    success: "bg-emerald-500/15 text-[var(--success)] ring-1 ring-emerald-500/20",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/20",
    danger: "bg-orange-500/15 text-[var(--danger)] ring-1 ring-orange-500/20",
    brand: "bg-[var(--brand-soft)] text-[var(--brand)] ring-1 ring-[color-mix(in_srgb,var(--brand)_25%,transparent)]",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", map[tone])}>
      {children}
    </span>
  );
}
