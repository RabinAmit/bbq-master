"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser"; // important: importing this triggers PKCE code processing

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Give supabase a tick to auto-exchange the ?code and persist the session
    const run = async () => {
      // Touch the client so tree-shaking can’t drop it, then verify session
      await supabase.auth.getSession();
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession();
        router.replace(data.session ? "/" : "/login?error=session_missing");
      }, 150);
    };
    run();
  }, [router]);

  return <main className="p-6">Finishing sign-in…</main>;
}
