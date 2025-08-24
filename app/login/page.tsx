"use client";
import { supabase } from "@/lib/supabase-browser";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
