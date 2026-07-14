"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ message: string; token: string | null }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
      setToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-mesh opacity-20">
          <span />
          <span />
          <span />
        </div>
      </div>
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md animate-scale-in rounded-[1.75rem] border border-white/70 bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur-xl"
      >
        <div className="mb-2 h-1.5 w-12 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--accent)]" />
        <h1 className="text-2xl font-bold">Lupa password</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Kami akan membuat token reset (untuk production dikirim email).
        </p>
        <div className="mt-6 space-y-4">
          <Input
            label="Email akun"
            type="email"
            required
            icon={<Mail size={16} />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          {message && <p className="text-sm text-[var(--success)]">{message}</p>}
          {token && (
            <div className="animate-fade-up rounded-xl bg-[var(--brand-soft)] p-3 text-sm">
              <p className="font-medium">Token (dev):</p>
              <p className="mt-1 break-all">{token}</p>
              <Link
                href={`/reset-password?token=${token}`}
                className="mt-2 inline-block font-semibold text-[var(--brand)]"
              >
                Lanjut reset password →
              </Link>
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full py-3">
            Kirim token
          </Button>
        </div>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-[var(--brand)]">
          Kembali login
        </Link>
      </form>
    </div>
  );
}
