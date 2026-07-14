"use client";

import { FormEvent, useEffect, useState } from "react";
import { Protected } from "@/components/Protected";
import { Button, Card, Input, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BRAND_PRESETS, DEFAULT_BRAND, normalizeHex } from "@/lib/brand-palette";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/format";
import { PwaInstallCard } from "@/components/PwaInstallCard";
import { Briefcase, Check, Lock, Mail, Moon, Palette, RotateCcw, Sun, UserRound } from "lucide-react";

export default function SettingsPage() {
  const { user, business, refresh } = useAuth();
  const { theme, setTheme, brandColor, setBrandColor, resetBrandColor } = useTheme();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [customHex, setCustomHex] = useState(brandColor);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (business?.name) setBusinessName(business.name);
  }, [user?.name, business?.name]);

  useEffect(() => {
    setCustomHex(brandColor);
  }, [brandColor]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      if (business?.id && (business.role === "OWNER" || business.role === "ADMIN")) {
        await api(`/api/businesses/${business.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: businessName }),
        });
      }
      await refresh();
      setMessage("Profil berhasil disimpan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal simpan");
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(passwords),
      });
      setPasswords({ currentPassword: "", newPassword: "" });
      setMessage("Password berhasil diubah");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal ubah password");
    }
  }

  function applyCustomHex() {
    const next = normalizeHex(customHex);
    if (!next) {
      setError("Format warna tidak valid. Gunakan hex seperti #0b5f56");
      return;
    }
    setError("");
    setBrandColor(next);
    setMessage("Warna tema diperbarui");
  }

  const isPreset = BRAND_PRESETS.some((p) => p.color === brandColor);

  return (
    <Protected>
      <PageHeader title="Pengaturan" subtitle="Kelola profil, tampilan, dan keamanan akun." />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <PwaInstallCard />
        </div>
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <Palette size={18} />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Tampilan & warna</h2>
              <p className="text-sm text-[var(--muted)]">
                Pilih preset atau warna custom. Mode terang & gelap, sidebar, tombol, dan aksen ikut berubah otomatis.
              </p>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                theme === "light"
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "border-[var(--line)] hover:bg-[var(--brand-soft)]"
              )}
            >
              <Sun size={15} /> Terang
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                theme === "dark"
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "border-[var(--line)] hover:bg-[var(--brand-soft)]"
              )}
            >
              <Moon size={15} /> Gelap
            </button>
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Preset warna</p>
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BRAND_PRESETS.map((p) => {
              const active = brandColor === p.color;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setBrandColor(p.color);
                    setMessage(`Tema ${p.label} diterapkan`);
                    setError("");
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition",
                    active
                      ? "border-[var(--brand)] bg-[var(--brand-soft)] shadow-sm"
                      : "border-[var(--line)] bg-white hover:border-[var(--brand)]/40 dark:bg-[var(--bg-elevated)]"
                  )}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white shadow-sm"
                    style={{ background: p.color }}
                  >
                    {active && <Check size={14} />}
                  </span>
                  {p.label}
                </button>
              );
            })}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Warna custom</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-3">
              <label className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] shadow-sm">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => {
                    setBrandColor(e.target.value);
                    setCustomHex(e.target.value);
                    setMessage("Warna tema diperbarui");
                    setError("");
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Pilih warna custom"
                />
                <span className="block h-full w-full" style={{ background: brandColor }} />
              </label>
              <div className="min-w-[9rem] flex-1">
                <Input
                  label="Kode hex"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyCustomHex();
                    }
                  }}
                />
              </div>
            </div>
            <Button type="button" variant="secondary" onClick={applyCustomHex}>
              Terapkan
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetBrandColor();
                setMessage("Warna dikembalikan ke default Catetrek");
                setError("");
              }}
              disabled={brandColor === DEFAULT_BRAND}
            >
              <RotateCcw size={15} /> Reset
            </Button>
          </div>

          {!isPreset && brandColor !== DEFAULT_BRAND && (
            <p className="mt-3 text-xs text-[var(--muted)]">Memakai warna custom {brandColor}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white">Brand</span>
            <span className="rounded-lg bg-[var(--brand-mid)] px-3 py-1.5 text-xs font-semibold text-white">Mid</span>
            <span className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white">Aksen</span>
            <span className="rounded-lg bg-[var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--brand)]">
              Soft
            </span>
            <Button type="button" className="!py-1.5 !text-xs">
              Contoh tombol
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Profil & bisnis</h2>
          <form onSubmit={saveProfile} className="stagger space-y-3.5">
            <Input
              label="Nama"
              icon={<UserRound size={16} />}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input label="Email" icon={<Mail size={16} />} value={user?.email || ""} disabled />
            <Input
              label="Nama bisnis"
              icon={<Briefcase size={16} />}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <Button type="submit">Simpan perubahan</Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Ubah password</h2>
          <form onSubmit={changePassword} className="stagger space-y-3.5">
            <Input
              label="Password saat ini"
              type="password"
              required
              icon={<Lock size={16} />}
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            />
            <Input
              label="Password baru"
              type="password"
              required
              minLength={8}
              icon={<Lock size={16} />}
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
            />
            <Button type="submit">Ubah password</Button>
          </form>
        </Card>
      </div>

      {(message || error) && (
        <p className={`mt-4 text-sm ${error ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
          {error || message}
        </p>
      )}
    </Protected>
  );
}
