import { redirect } from "next/navigation";
import { auth } from "./index";

export type AppRole = "prospect" | "client" | "staff" | "partner";

/** Server-side: require a logged-in user; otherwise redirect to /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Server-side: require one of the given roles; otherwise 404 (don't leak existence). */
export async function requireRole(...allowed: AppRole[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role as AppRole)) {
    // Show 404 rather than 403 — admin existence should not be probeable.
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

/** API/Server Action variant: throws instead of redirecting. */
export async function assertRole(...allowed: AppRole[]) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHENTICATED");
  if (!allowed.includes(session.user.role as AppRole)) throw new Error("FORBIDDEN");
  return session.user;
}

/** Super admin = the platform operator (the code owner), designated by the
 *  SUPER_ADMIN_EMAILS env allowlist set at deploy time. Used to gate
 *  operator-only controls (e.g. the plan tier) away from tenant staff. */
export function isSuperAdmin(user: { email?: string | null } | null | undefined): boolean {
  const allow = (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = user?.email?.toLowerCase();
  return !!email && allow.includes(email);
}

/** Server helper: current logged-in user's super-admin status. */
export async function currentIsSuperAdmin(): Promise<boolean> {
  const session = await auth();
  return isSuperAdmin(session?.user);
}
