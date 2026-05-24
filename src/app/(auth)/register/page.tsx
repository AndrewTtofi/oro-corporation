import { redirect } from "next/navigation";

export default async function RegisterRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // /register is just the signup tab of /login — keep one source of truth.
  const sp = await searchParams;
  const qs = sp.next ? `?next=${encodeURIComponent(sp.next)}&tab=signup` : "?tab=signup";
  redirect(`/login${qs}`);
}
