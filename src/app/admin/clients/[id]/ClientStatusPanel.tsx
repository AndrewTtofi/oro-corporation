"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClientStatus } from "@prisma/client";

interface Person { id: string; name: string; role: string }

export function ClientStatusPanel({
  clientId, status, primaryStaff, extras, partners,
}: {
  clientId: string;
  status: ClientStatus;
  primaryStaff: Person;
  extras: Person[];
  partners: { id: string; fullName: string }[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  async function updateStatus(next: ClientStatus) {
    start(async () => {
      await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    });
  }

  return (
    <section className="bg-admin-surface border border-admin-border rounded-card p-6">
      <div className="text-[12px] font-bold uppercase text-admin-muted tracking-widest mb-3">Client Status</div>
      <select
        value={status}
        disabled={pending}
        onChange={(e) => void updateStatus(e.target.value as ClientStatus)}
        className="w-full px-3 py-2 rounded-inner text-meta"
        style={{ border: "1px solid var(--border)" }}
      >
        <option value="active">Active</option>
        <option value="on_hold">On Hold</option>
        <option value="completed">Completed</option>
      </select>

      <div className="text-[12px] font-bold uppercase text-admin-muted tracking-widest mt-6 mb-3">Assigned Team</div>
      <Member member={primaryStaff} accent />
      {extras.map((m) => <Member key={m.id} member={m} />)}

      <details className="mt-3">
        <summary className="cursor-pointer text-meta text-admin-muted text-[12px] font-semibold">Reassign / Manage Team</summary>
        <div className="mt-3 flex flex-col gap-2">
          {partners.map((p) => (
            <button
              key={p.id}
              type="button"
              className="text-[12px] text-left px-3 py-2 rounded-inner border border-admin-border hover:border-accent"
              onClick={() => alert(`Assignment to ${p.fullName} happens on services from the Services Engaged list (slice 7 finalize).`)}
            >
              + Assign {p.fullName}
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}

function Member({ member, accent }: { member: Person; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className="w-8 h-8 rounded-full grid place-items-center text-[10px] font-bold"
        style={accent ? { background: "var(--accent)", color: "var(--dark)" } : { background: "#EEE", color: "var(--dark)" }}
      >
        {member.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
      </div>
      <div className="text-meta">
        <div className="font-semibold">{member.name}</div>
        <div className="text-[11px] text-admin-muted">{member.role}</div>
      </div>
    </div>
  );
}
