"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/";

  useEffect(() => {
    // Supabase auto-exchanges the ?code when the client loads.
    const t = setTimeout(async () => {
      await supabase.auth.getSession(); // touch to ensure init ran
      router.replace(from);
    }, 150);
    return () => clearTimeout(t);
  }, [router, from]);

  return <main className="p-6">Finishing sign-in…</main>;
}
