"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

type EventRow = {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  dateTime: string;
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
  const [family, setFamily] = useState<Array<{ name: string; adult: boolean }>>(
    []
  );
  const [willBringText, setWillBringText] = useState("");

  const shareUrl = useMemo(
    () =>
      typeof window !== "undefined" ? `${window.location.origin}/e/${code}` : "",
    [code]
  );

  useEffect(() => {
    // Load the event by shareCode
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("shareCode", code)
        .single();
      setEvent((data as EventRow) || null);
      setLoading(false);
    })();
  }, [code]);

  useEffect(() => {
    // Watch auth and cache email
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

  async function ensureUserRow() {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user?.email) throw new Error("Please sign in to RSVP.");
    const email = u.user.email;
    const name = (u.user.user_metadata?.full_name as string) || null;
    const imageUrl = (u.user.user_metadata?.avatar_url as string) || null;

    const { data, error } = await supabase
      .from("users")
      .upsert({ email, name, imageUrl }, { onConflict: "email" })
      .select("id")
      .single();
    if (error) throw error;
    setUserId(data.id);
    return data.id as string;
  }

  // If logged in and we know event id + user id, load existing RSVP to prefill
  useEffect(() => {
    (async () => {
      if (!event) return;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.email) return;

      // ensure we know userId (and create user row if needed)
      const { data: userRow, error: ue } = await supabase
        .from("users")
        .select("id")
        .eq("email", u.user.email!)
        .single();
      if (ue) return; // user row might not exist yet; will be created on save
      setUserId(userRow?.id ?? null);

      const { data: r } = await supabase
        .from("rsvps")
        .select("*")
        .eq("eventId", event.id)
        .eq("userId", userRow.id)
        .maybeSingle();

      if (r) {
        setStatus((r.status as RsvpRow["status"]) ?? "");
        setNote(r.note ?? "");
        setFamily((r.familyJson as any) ?? []);
        setWillBringText(((r.willBringJson as any) ?? []).join(", "));
      }
    })();
  }, [event]);

  if (loading) return <main className="p-6">Loading event…</main>;
  if (!event) return <main className="p-6">Event not found.</main>;

  const dt = new Date(event.dateTime);
  const whenLocal = dt.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });

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
  const updateMember =
    (i: number, key: "name" | "adult") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFamily((arr) => {
        const next = arr.slice();
        // @ts-ignore
        next[i][key] = key === "adult" ? e.target.checked : e.target.value;
        return next;
      });
    };
  const removeMember = (i: number) =>
    setFamily((arr) => arr.filter((_, idx) => idx !== i));

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
          {
            eventId: event.id,
            userId: uid,
            status,
            note: note || null,
            familyJson: family,
            willBringJson: bring,
          },
          { onConflict: "eventId,userId" }
        )
        .select("*")
        .single();

      if (error) throw error;
      alert("RSVP saved. Thanks!");
    } catch (e: any) {
      console.error(e);
      alert("Could not save RSVP: " + (e?.message || String(e)));
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
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

      {/* RSVP */}
      <section className="rounded-lg border p-4 space-y-4">
        <h2 className="font-medium">RSVP</h2>

        {email ? (
          <>
            {/* RSVP options */}
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

            {/* Special requests */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Special requests</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Gluten free, Vegan, No onions, etc."
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            {/* Family members */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Family members</label>
                <button
                  type="button"
                  onClick={addMember}
                  className="rounded border px-2 py-1 text-xs"
                >
                  + Add member
                </button>
              </div>
              {family.length === 0 && (
                <p className="text-xs text-gray-500">
                  Add adults/kids coming with you (optional).
                </p>
              )}
              <div className="space-y-2">
                {family.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                    <input
                      placeholder="Name"
                      value={m.name}
                      onChange={updateMember(i, "name")}
                      className="rounded-md border px-3 py-2"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={m.adult}
                        onChange={updateMember(i, "adult")}
                      />
                      Adult
                    </label>
                    <button
                      type="button"
                      onClick={() => removeMember(i)}
                      className="text-xs text-red-600"
                    >
                      remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Will bring */}
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
          <p className="text-sm text-gray-600">
            Please sign in to RSVP.
          </p>
        )}
      </section>
    </main>
  );
}
