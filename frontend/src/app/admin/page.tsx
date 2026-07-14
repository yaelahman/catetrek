"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/lib/auth";

export default function AdminIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user?.isSuperAdmin) {
      router.replace("/dashboard");
      return;
    }
    router.replace("/admin/users");
  }, [user?.isSuperAdmin, loading, router]);

  return (
    <Protected>
      <p className="text-sm text-[var(--muted)]">Membuka panel admin...</p>
    </Protected>
  );
}
