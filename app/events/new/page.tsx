"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import type { PostgrestError } from "@supabase/supabase-js";

type DraftEvent = {
  title: string;
  dateTime: string; // HTML datetime-local value
  location: string;
  description: string;
  extrasCsv: string; // comma-separated
  timezone: string;
};

type InsertedEvent = { id: string; shareCode: string };

function generateShareCode(len = 7) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

function isPostgrestError(e: unknown): e is PostgrestError {
  return !!e && typeof e === "object" && "code" in e && "message" in e;
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export default function NewEventPage() {
  const router = useRouter();
  const [status, setStatus] = useState<
    "init" | "checking-auth" | "redirecting" | "authed" | "saving" | "saved" | "error"
  >("init");
  const [error, setError] = useState<string | null>(null);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [draft, setDraft] = useState<DraftEvent>({
    title: "",
    dateTime: "",
    location: "",
    description: "",
    extrasCsv: "",
    timezone: tz,
  });

  useEffect(() => {
    (async () => {
      setStatus("checking-auth");
      const { data, error: authErr } = await supabase.auth.getSession();
      if (authErr) {
        setError(authErr.message);
        setStatus("error");
        return;
      }
      if (!data.session) {
        setStatus("redirecting");
        router.replace("/login?from=/events/new");
        return;
      }
      setStatus("authed");
    })();
  }, [router]);

  const onChange =
    (key: keyof DraftEvent) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }));

  async function ensureUserRow(): Promise<{ id: string; email: string }> {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user?.email) throw new Error("Not signed in");

    const email = u.user.email;
    const name = (u.user.user_metadata?.full_name as string | undefined) ?? null;
    const imageUrl = (u.user.user_metadata?.avatar_url as string | undefined) ?? null;

    const { data, error } = await supabase
  .from("users")
  .upsert({ email, name, imageUrl }, { onConflict: "email" })
  .select("id, email")
  .single() as unknown as { data: { id: string; email: string }; error: PostgrestError | null };


    if (error) throw error;
    return data;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setStatus("saving");

      const user = await ensureUserRow();
      const extras = draft.extrasCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const dateTimeIso = new Date(draft.dateTime).toISOString();

      let created: InsertedEvent | null = null;
      let tries = 0;
      let lastErr: PostgrestError | null = null;

      while (!created && tries < 5) {
        const code = generateShareCode();
        const { data, error } = await supabase
          .from("events")
          .insert({
            hostId: user.id,
            title: draft.title,
            description: draft.description || null,
            dateTime: dateTimeIso,
            timezone: draft.timezone,
            location: draft.location || null,
            extras,
            shareCode: code,
          })
  .select("id, shareCode")
  .single() as unknown as { data: InsertedEvent; error: PostgrestError | null };


        if (!error && data) {
          created = data;
        } else if (error && isPostgrestError(error) && error.code === "23505") {
          // unique violation on shareCode
          tries++;
          lastErr = error;
        } else if (error) {
          throw error;
        }
      }

      if (!created) throw lastErr ?? new Error("Could not create event");

      // Success: go to the event’s public page
      router.replace(`/e/${created.shareCode}`);
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      console.error(e);
      setError(msg);
      setStatus("error");
      alert("Failed to create event: " + msg);
    }
  };

  if (status !== "authed") {
    return (
      <main className="p-6 space-y-2">
        <div className="text-sm">
          status: <b>{status}</b>
        </div>
        {error && <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>}
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Create Event</h1>
        <p className="text-sm text-gray-500">Timezone: <span className="font-mono">{tz}</span></p>
      </header>

      <form className="space-y-4" onSubmit={onSubmit}>
        <input type="hidden" name="timezone" value={tz} />

        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">Title *</label>
          <input id="title" required value={draft.title} onChange={onChange("title")} className="w-full rounded-md border px-3 py-2" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="dateTime" className="text-sm font-medium">Date & time *</label>
            <input id="dateTime" type="datetime-local" required value={draft.dateTime} onChange={onChange("dateTime")} className="w-full rounded-md border px-3 py-2" />
          </div>
          <div className="space-y-1">
            <label htmlFor="location" className="text-sm font-medium">Location</label>
            <input id="location" value={draft.location} onChange={onChange("location")} className="w-full rounded-md border px-3 py-2" />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <textarea id="description" rows={3} value={draft.description} onChange={onChange("description")} className="w-full resize-y rounded-md border px-3 py-2" />
        </div>

        <div className="space-y-1">
          <label htmlFor="extras" className="text-sm font-medium">Extras (comma-separated)</label>
          <input id="extras" value={draft.extrasCsv} onChange={onChange("extrasCsv")} className="w-full rounded-md border px-3 py-2" />
        </div>

        <div className="pt-2">
          <button type="submit" className="rounded-lg border px-4 py-2 text-sm">Save</button>
        </div>
      </form>
    </main>
  );
}
