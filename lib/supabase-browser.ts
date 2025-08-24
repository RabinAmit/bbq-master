import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      flowType: "pkce",
      // detectSessionInUrl defaults to true; leaving it explicit is fine.
      detectSessionInUrl: true,
      persistSession: true,
    },
  }
);
