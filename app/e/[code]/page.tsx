"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import type { PostgrestError } from "@supabase/supabase-js";

type EventRow = {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  dateTime: string;     // ISO
  timezone: string;
  location: string | null;
  extras: string[] | null;
  shareCode: string;
};

type RsvpRow = {
  id: string;
  eventId: string;
  userId: string;
  status: "YES" | "LATE_YES" | "MAYBE" | "NO";
  note: string | null;
  familyJson: Array<{ name: string; adult: boolean }> | null;
  willBringJson: string[] | null;
};

const DEFAULT_LABELS = {
  YES: "Of Course!",
  LATE_YES: "Sure, but late as usual",
  MAYBE: "Will do my best, but can't promise",
  NO: "No. I'm just a crappy friend",
};

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export default function EventViewPage() {
  const router = useRouter();
  const { code } = useParams<{ code: string }>();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // RSVP form state
  const [status, setStatus] = useState<RsvpRow["status"] | "">("");
  const [note, setNote] = useState("");
  const [family, setFamily] = useState<Array<{ name: string; adult: boolean }>>([]);
  const [willBringText, setWillBringText] = useState("");

  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/e/${code}` : ""),
    [code]
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("shareCode", code)
        .single() as unknown as { data: EventRow | null };
      setEvent(data ?? null);
      setLoading(false);
    })();
  }, [code]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Prefill RSVP if it exists
  useEffect(() => {
    (async () => {
      if (!event) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.email) return;

      const { data: userRow } = await supabase
        .from("users")
        .select("id")
        .eq("email", u.user.email!)
        .maybeSingle() as unknown as { data: { id: string } | null };

      if (!userRow) return;
      setUserId(userRow.id);

      const { data: r } = await supabase
        .from("rsvps")
        .select("*")
        .eq("eventId", event.id)
        .eq("userId", userRow.id)
        .maybeSingle() as unknown as { data: RsvpRow | null };


      if (r) {
        setStatus(r.status ?? "");
        setNote(r.note ?? "");
        setFamily(r.familyJson ?? []);
        setWillBringText((r.willBringJson ?? []).join(", "));
      }
    })();
  }, [event]);

  if (loading) return <main className="p-6">Loading event…</main>;
  if (!event) return <main className="p-6">Event not found.</main>;

  const dt = new Date(event.dateTime);
  const whenLocal = dt.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });

  const signIn = () => {
    router.push(`/login?from=/e/${event.shareCode}`);
  };

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
    } catch {
      alert("Copy failed. You can copy the URL from the address bar.");
    }
  };

  const addMember = () => setFamily((arr) => [...arr, { name: "", adult: true }]);

  const updateMemberName =
    (i: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFamily((arr) => {
        const next = arr.slice();
        const current = next[i] || { name: "", adult: true };
        next[i] = { ...current, name: e.target.value };
        return next;
      });
    };

  const updateMemberAdult =
    (i: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFamily((arr) => {
        const next = arr.slice();
        const current = next[i] || { name: "", adult: true };
        next[i] = { ...current, adult: e.target.checked };
        return next;
      });
    };

  const removeMember = (i: number) => setFamily((arr) => arr.filter((_, idx) => idx !== i));

  async function ensureUserRow(): Promise<string> {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user?.email) throw new Error("Please sign in to RSVP.");
    const emailVal = u.user.email;
    const name = (u.user.user_metadata?.full_name as string | undefined) ?? null;
    const imageUrl = (u.user.user_metadata?.avatar_url as string | undefined) ?? null;

    const { data, error } = await supabase
      .from("users")
      .upsert({ email: emailVal, name, imageUrl }, { onConflict: "email" })
      .select("id")
      .single() as unknown as { data: { id: string }; error: PostgrestError | null };

    if (error) throw error;
    setUserId(data.id);
    return data.id;
  }

  const saveRsvp = async () => {
    try {
      const uid = userId ?? (await ensureUserRow());
      if (!status) {
        alert("Please choose an RSVP option.");
        return;
      }
      const bring = willBringText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const { error } = await supabase
        .from("rsvps")
        .upsert(
          { /* ... */ },
          { onConflict: "eventId,userId" }
        )
        .select("*")
        .single();


      if (error) throw error;
      alert("RSVP saved. Thanks!");
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      console.error(e);
      alert("Could not save RSVP: " + msg);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{event.title}</h1>
        <p className="text-sm text-gray-600">{whenLocal}</p>
        {event.location && <p className="text-sm text-gray-600">📍 {event.location}</p>}
        <div className="flex flex-wrap gap-2">
          {(event.extras ?? []).map((x) => (
            <span key={x} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
              {x}
            </span>
          ))}
        </div>
        <div className="pt-1 flex gap-2">
          <button onClick={copyShare} className="rounded-lg border px-3 py-1 text-sm">
            Copy share link
          </button>
          {!email && (
            <button onClick={signIn} className="rounded-lg border px-3 py-1 text-sm">
              Sign in to RSVP
            </button>
          )}
        </div>
      </header>

      <section className="rounded-lg border p-4 space-y-4">
        <h2 className="font-medium">RSVP</h2>

        {email ? (
          <>
            <div className="grid gap-2">
              {(
                [
                  ["YES", DEFAULT_LABELS.YES],
                  ["LATE_YES", DEFAULT_LABELS.LATE_YES],
                  ["MAYBE", DEFAULT_LABELS.MAYBE],
                  ["NO", DEFAULT_LABELS.NO],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rsvp"
                    value={value}
                    checked={status === value}
                    onChange={() => setStatus(value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Special requests</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Gluten free, Vegan, No onions, etc."
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Family members</label>
                <button type="button" onClick={addMember} className="rounded border px-2 py-1 text-xs">
                  + Add member
                </button>
              </div>

              {family.length === 0 && (
                <p className="text-xs text-gray-500">Add adults/kids coming with you (optional).</p>
              )}

              <div className="space-y-2">
                {family.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                    <input
                      placeholder="Name"
                      value={m.name}
                      onChange={updateMemberName(i)}
                      className="rounded-md border px-3 py-2"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={m.adult} onChange={updateMemberAdult(i)} />
                      Adult
                    </label>
                    <button type="button" onClick={() => removeMember(i)} className="text-xs text-red-600">
                      remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">I’ll bring (comma-separated)</label>
              <input
                value={willBringText}
                onChange={(e) => setWillBringText(e.target.value)}
                placeholder="e.g., salad, beer, ice"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div className="pt-2">
              <button onClick={saveRsvp} className="rounded-lg border px-4 py-2 text-sm">
                Save RSVP
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600">Please sign in to RSVP.</p>
        )}
      </section>
    </main>
  );
}
