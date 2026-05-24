"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type DocRowProps = {
  id: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  status: "received" | "under_review" | "approved" | "reupload_needed";
  uploadedAt: string;
};

export function DocumentRow({ doc }: { doc: DocRowProps }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function setStatus(status: DocRowProps["status"]) {
    start(async () => {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
    });
  }
  function remove() {
    if (!confirm(`Delete ${doc.originalName}?`)) return;
    start(async () => {
      const res = await fetch(`/api/admin/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
      <tr className="border-t border-admin-border">
        <td className="p-2"><button type="button" onClick={() => setOpen((v) => !v)} className="underline text-meta">{doc.originalName}</button></td>
        <td className="p-2 text-meta">{doc.mime}</td>
        <td className="p-2 font-mono text-meta">{(doc.sizeBytes / 1024).toFixed(0)} KB</td>
        <td className="p-2 font-mono text-meta">{new Date(doc.uploadedAt).toLocaleDateString("en-GB")}</td>
        <td className="p-2">
          <select value={doc.status} onChange={(e) => setStatus(e.target.value as DocRowProps["status"])} disabled={pending} className="input py-1 px-2 text-meta">
            <option value="received">Received</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="reupload_needed">Re-upload needed</option>
          </select>
        </td>
        <td className="p-2"><button type="button" onClick={remove} disabled={pending} className="text-[12px] underline text-[#DC2626]">Delete</button></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="p-2">
            <iframe src={`/api/documents/${doc.id}`} className="w-full h-[480px] bg-admin-bg border border-admin-border rounded-elem" />
          </td>
        </tr>
      )}
    </>
  );
}
