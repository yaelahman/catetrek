"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Input } from "@/components/ui";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(params.get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal reset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md animate-scale-in rounded-[1.75rem] border border-white/70 bg-white/90 p-8 shadow-[var(--shadow)] backdrop-blur-xl"
    >
      <div className="mb-2 h-1.5 w-12 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--accent)]" />
      <h1 className="text-2xl font-bold">Reset password</h1>
      <div className="mt-6 space-y-4">
        <Input
          label="Token reset"
          required
          icon={<KeyRound size={16} />}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <Input
          label="Password baru"
          type="password"
          required
          minLength={8}
          icon={<Lock size={16} />}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full py-3">
          Simpan password
        </Button>
      </div>
      <Link href="/login" className="mt-6 inline-block text-sm font-medium text-[var(--brand)]">
        Kembali login
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-mesh opacity-20">
          <span />
          <span />
          <span />
        </div>
      </div>
      <Suspense fallback={<p>Memuat...</p>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
