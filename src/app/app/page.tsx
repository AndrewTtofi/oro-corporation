import { redirect } from "next/navigation";

// /app has no content of its own — send clients to their dashboard.
// (Login redirects clients to "/app"; without this the route 404s.)
export default function AppIndex() {
  redirect("/app/dashboard");
}
