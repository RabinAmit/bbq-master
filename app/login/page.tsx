"use client";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function LoginInner() {
  const params = useSearchParams();
  const from = params.get("from") || "/";

  const signInWithGoogle = async () => {
    const origin = window.location.origin; // local or prod, whichever you're on
    const redirectTo = `${origin}/auth/callback?from=${encodeURIComponent(from)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) alert(error.message);
  };

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <button
          onClick={signInWithGoogle}
          className="w-full rounded-lg border px-4 py-2"
        >
          Continue with Google
        </button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <LoginInner />
    </Suspense>
  );
}
