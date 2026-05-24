import { redirect } from "next/navigation";

export default function AdminRoot() {
  // The prompt names /admin as the overview; the submissions queue is the
  // canonical landing surface for staff. KPI-style overview is /admin/analytics.
  redirect("/admin/submissions");
}
