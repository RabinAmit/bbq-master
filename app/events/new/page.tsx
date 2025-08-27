"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

type DraftEvent = {
  title: string;
  dateTime: string;
  location: string;
  description: string;
  extrasCsv: string;
  timezone: string;
};

function generateShareCode(len = 7) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
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
      try {
        setStatus("checking-auth");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          setStatus("redirecting");
          router.replace("/login?from=/events/new");
          return;
        }
        setStatus("authed");
      } catch (e: any) {
        console.error("Auth check failed:", e);
        setError(e?.message ?? String(e));
        setStatus("error");
      }
    })();
  }, [router]);

  const onChange =
    (key: keyof DraftEvent) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }));

  const ensureUserRow = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user?.email) throw new Error("Not signed in");
    const email = u.user.email;
    const name = (u.user.user_metadata?.full_name as string) || null;
    const imageUrl = (u.user.user_metadata?.avatar_url as string) || null;

    const { data, error } = await supabase
      .from("users")
      .upsert({ email, name, imageUrl }, { onConflict: "email" })
      .select("id, email")
      .single();

    if (error) throw error;
    return data as { id: string; email: string };
  };

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

      let created: { id: string; shareCode: string } | null = null;
      let tries = 0;

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
          .single();

        if (!error && data) {
          created = data as { id: string; shareCode: string };
        } else if ((error as any)?.code === "23505") {
          tries++;
        } else if (error) {
          throw error;
        }
      }

      if (!created) throw new Error("Could not create event after retries.");
      setStatus("saved");
      // alert(`Event created!\n\nShare code: ${created.shareCode}`);
      router.replace(`/e/${created.shareCode}`);
    } catch (e: any) {
      console.error("Save failed:", e);
      setError(e?.message ?? String(e));
      setStatus("error");
    }
  };

  // Always show status so we don't get a blank screen
  if (status !== "authed") {
    return (
      <main className="p-6 space-y-2">
        <div className="text-sm">status: <b>{status}</b></div>
        {error && <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>}
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Create Event</h1>
        <p className="text-sm text-gray-500">
          Timezone: <span className="font-mono">{tz}</span>
        </p>
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
