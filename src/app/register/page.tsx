"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Briefcase, Lock, Mail, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    businessName: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(form);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrasi gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-mesh opacity-25">
          <span />
          <span />
          <span />
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md animate-scale-in rounded-[1.75rem] border border-white/70 bg-white/90 p-7 shadow-[var(--shadow)] backdrop-blur-xl sm:p-9"
      >
        <div className="mb-1 h-1.5 w-14 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--accent)]" />
        <p className="h-brand text-3xl font-bold">Catetrek</p>
        <h1 className="mt-4 text-2xl font-bold">Daftarkan usaha Anda</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Setup awal otomatis: kas, kategori, dan akun owner.
        </p>

        <div className="stagger mt-6 space-y-3.5">
          <Input
            label="Nama Anda"
            required
            icon={<UserRound size={16} />}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Nama Bisnis"
            required
            icon={<Briefcase size={16} />}
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            required
            icon={<Mail size={16} />}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Password (min. 8)"
            type="password"
            required
            minLength={8}
            icon={<Lock size={16} />}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            hint="Gunakan kombinasi huruf dan angka agar lebih aman"
          />
          {error && (
            <p className="animate-fade-up rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full py-3 text-base">
            {busy ? "Membuat akun..." : "Buat akun bisnis"}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-semibold text-[var(--brand)] hover:opacity-70">
            Masuk
          </Link>
        </p>
      </form>
    </div>
  );
}
