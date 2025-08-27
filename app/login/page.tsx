"use client";
import { supabase } from "@/lib/supabase-browser";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const params = useSearchParams();
  const from = params.get("from") || "/";

  const signInWithGoogle = async () => {
    const origin = window.location.origin; // <- current environment (local or prod)
    const redirectTo = `${origin}/auth/callback?from=${encodeURIComponent(from)}`;

    console.log("OAuth redirectTo =", redirectTo); // debug line
    // OPTIONAL: temporary toast/dialog to confirm; remove later if you want
    // alert("redirectTo = " + redirectTo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }, // Supabase must allow this in its Redirect URLs list
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
