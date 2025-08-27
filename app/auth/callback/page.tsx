"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

export const dynamic = "force-dynamic";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/";

  useEffect(() => {
    // Supabase auto-exchanges the ?code on load; we just wait a tick then go back.
    const t = setTimeout(async () => {
      await supabase.auth.getSession();
      router.replace(from);
    }, 150);
    return () => clearTimeout(t);
  }, [router, from]);

  return <main className="p-6">Finishing sign-in…</main>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="p-6">Finishing sign-in…</main>}>
      <CallbackInner />
    </Suspense>
  );
}
