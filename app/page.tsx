"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Get current user once
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
    });

    // Keep UI in sync with sign-in/out events
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setEmail(null);
    window.location.href = "/login";
  };

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">BBQ Master</h1>

      {email ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Signed in as {email}</span>
          {/* Below the signed-in status */}
          <div>
            <a href="/events/new" className="inline-block mt-2 rounded-lg border px-3 py-1 text-sm">
              Create Event
            </a>
          </div>
          <button onClick={signOut} className="rounded-lg border px-3 py-1 text-sm">
            Sign out
          </button>
        </div>
      ) : (
        <Link href="/login" className="underline">Sign in</Link>
      )}
    </main>
  );
}
