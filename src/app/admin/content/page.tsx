import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "Content" };

/**
 * Basic content editor placeholder. The marketing pages currently pull copy from
 * `SERVICES` in src/components/marketing — full content editing is intentionally
 * out of scope for the MVP per the prompt ("blog/CMS beyond basic text editing"
 * is NOT in scope). This page surfaces the source-of-truth locations.
 */
export default function AdminContentPage() {
  return (
    <AdminShell active="content">
      <h1 className="text-2xl font-bold mb-2">Content</h1>
      <p className="text-meta text-admin-muted mb-8">
        Marketing copy is currently maintained in code for the MVP. Edit the files below to update the public pages.
      </p>

      <div className="bg-admin-surface border border-admin-border rounded-card p-6 max-w-[680px]">
        <h2 className="font-bold text-base mb-3">Sources of truth</h2>
        <ul className="flex flex-col gap-3 text-meta">
          <li>
            <span className="font-mono text-admin-muted">src/components/marketing/ServiceIcons.tsx</span>
            <p className="text-[12px] text-admin-muted mt-1">Service titles, blurbs, and longer copy used by /, /services, and the onboarding picker.</p>
          </li>
          <li>
            <span className="font-mono text-admin-muted">src/app/page.tsx</span>
            <p className="text-[12px] text-admin-muted mt-1">Landing page sections (hero, how it works, stats, CTA).</p>
          </li>
          <li>
            <span className="font-mono text-admin-muted">src/components/marketing/Footer.tsx</span>
            <p className="text-[12px] text-admin-muted mt-1">Contact details + footer links.</p>
          </li>
        </ul>
      </div>
    </AdminShell>
  );
}
