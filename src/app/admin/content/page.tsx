import { AdminShell } from "@/components/admin/AdminShell";
import { requireRole } from "@/lib/auth/guards";
import { getSiteContent } from "@/lib/services/content";
import { ContentEditor } from "./ContentEditor";

export const metadata = { title: "Content" };
export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  await requireRole("staff");
  const content = await getSiteContent();
  return (
    <AdminShell active="content">
      <div className="mb-8">
        <div className="eyebrow mb-2">Marketing site</div>
        <h2 style={{ fontSize: "1.563rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Content</h2>
        <p className="mt-2 max-w-[60ch] text-muted" style={{ fontSize: "0.9375rem", lineHeight: 1.6 }}>
          Edit the copy on your public landing page and FAQ. Changes apply live. Service cards
          are managed under Settings → Services; branding under Settings → Branding.
        </p>
      </div>
      <ContentEditor initial={content} />
    </AdminShell>
  );
}
