"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Expert { id: string; fullName: string; email: string }
interface Slot { startUtc: string; available: boolean }
interface Day { dateIso: string; slots: Slot[] }
interface Availability { tz: string; days: Day[] }

export function BookingFlow({ experts, reference }: { experts: Expert[]; reference: string }) {
  const [expertId, setExpertId] = useState<string>(experts[0]?.id ?? "");
  const [tz, setTz] = useState<string>("Europe/Nicosia");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ when: string; expert: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    // Detect browser timezone once on mount; falls back to Europe/Nicosia.
    try { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Nicosia"); }
    catch { /* keep default */ }
  }, []);

  useEffect(() => {
    if (!expertId) return;
    setAvailability(null);
    setSelectedSlot(null);
    void fetch(`/api/bookings/availability?expertId=${expertId}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json() as Promise<Availability>)
      .then(setAvailability);
  }, [expertId, tz]);

  const activeDay = availability?.days.find((d) => d.slots.some((s) => s.startUtc === selectedSlot))
                 ?? availability?.days[0];

  function onConfirm() {
    if (!selectedSlot || !expertId) return;
    setError(null);
    start(async () => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId, startUtc: selectedSlot, timezone: tz }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error === "SLOT_TAKEN" ? "That slot was just taken — please pick another." : "Could not confirm booking. Try again.");
        return;
      }
      const body = (await res.json()) as { booking: { startsAt: string; expert: string } };
      setConfirmation({
        when: new Date(body.booking.startsAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: tz }),
        expert: body.booking.expert,
      });
      router.refresh();
    });
  }

  if (confirmation) {
    return (
      <div className="max-w-[640px] mx-auto text-center mt-12">
        <div className="w-20 h-20 mx-auto mb-8 rounded-full grid place-items-center text-3xl animate-scale-in"
             style={{ background: "var(--accent)", color: "var(--dark)" }}>
          ✓
        </div>
        <h1 className="font-display text-3xl mb-3">Booking confirmed</h1>
        <p className="text-muted text-lg mb-2">{confirmation.when}</p>
        <p className="text-muted mb-10">with {confirmation.expert}</p>
        <p className="text-meta text-muted">
          We&apos;ve sent a confirmation email with a calendar invite. You&apos;ll get a reminder 24 hours and 1 hour before.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px]">
      <div className="flex items-center justify-between mb-12 flex-wrap gap-4">
        <div>
          <p className="eyebrow mb-2">Final step · Application {reference}</p>
          <h1 className="font-display text-3xl">Book Your Free Consultation</h1>
          <p className="text-muted mt-2 text-meta">Choose a time that works for you. All consultations are conducted via video call.</p>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-8">
          <section className="surface rounded-card p-8">
            <h2 className="text-lg font-semibold mb-6">Choose an expert</h2>
            <div className="flex flex-col gap-3">
              {experts.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setExpertId(e.id)}
                  className={`flex items-center gap-4 p-4 rounded-elem border transition-all ${expertId === e.id ? "" : "hover:border-accent"}`}
                  style={
                    expertId === e.id
                      ? { borderColor: "var(--accent)", boxShadow: "0 4px 12px rgba(200,164,90,0.1)" }
                      : { borderColor: "var(--border)" }
                  }
                >
                  <span className="w-12 h-12 rounded-full grid place-items-center text-accent" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                    {initialsOf(e.fullName)}
                  </span>
                  <span className="flex-1 text-left">
                    <span className="block font-semibold">{e.fullName}</span>
                    <span className="block text-meta text-muted">{e.email}</span>
                  </span>
                  {expertId === e.id && <span className="text-accent">✓</span>}
                </button>
              ))}
            </div>
          </section>

          <section className="surface rounded-card p-8">
            <h2 className="text-lg font-semibold mb-6">Available slots ({tz})</h2>
            {!availability ? (
              <p className="text-meta text-muted">Loading…</p>
            ) : availability.days.length === 0 ? (
              <p className="text-meta text-muted">No availability in the next 2 weeks. Please contact support.</p>
            ) : (
              <div className="flex flex-col gap-6">
                {availability.days.map((d) => (
                  <div key={d.dateIso}>
                    <h3 className="text-meta font-semibold mb-3">
                      {new Date(d.dateIso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                    </h3>
                    <div className="flex gap-2 flex-wrap">
                      {d.slots.map((s) => {
                        const selected = selectedSlot === s.startUtc;
                        return (
                          <button
                            key={s.startUtc}
                            type="button"
                            onClick={() => setSelectedSlot(s.startUtc)}
                            disabled={!s.available}
                            className="px-4 py-2.5 rounded-inner text-meta font-medium transition-all"
                            style={
                              selected
                                ? { background: "var(--dark)", color: "var(--accent)", border: "1px solid var(--dark)" }
                                : { border: "1px solid var(--border)", opacity: s.available ? 1 : 0.3, cursor: s.available ? "pointer" : "not-allowed" }
                            }
                          >
                            {new Date(s.startUtc).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz })}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside>
          <div className="surface rounded-card p-8 sticky top-8">
            <h3 className="text-meta font-semibold uppercase tracking-widest text-muted mb-4">Your selection</h3>
            {selectedSlot && activeDay ? (
              <>
                <p className="text-meta text-muted mb-1">{new Date(activeDay.dateIso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
                <p className="font-display text-2xl mb-6">
                  {new Date(selectedSlot).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz })}
                </p>
              </>
            ) : (
              <p className="text-meta text-muted mb-6">Pick an expert and a time slot to continue.</p>
            )}

            {error && (
              <div className="rounded-elem p-3 text-meta mb-4" style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626" }}>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={onConfirm}
              disabled={!selectedSlot || pending}
              className="btn btn-accent w-full px-6 py-3.5 disabled:opacity-30"
            >
              {pending ? "Confirming…" : "Confirm Booking"}
            </button>
            <p className="text-[12px] text-muted mt-4 leading-relaxed">
              You&apos;ll receive a calendar invite by email. Reminders go out 24 hours and 1 hour before.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function initialsOf(name: string): string {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2);
}
