import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cheap liveness probe — used by the Docker healthcheck and Caddy.
 * Does NOT touch the DB; readiness lives at /api/ready (added in slice 2).
 */
export function GET() {
  return NextResponse.json({ ok: true, service: "oro-web", time: new Date().toISOString() });
}
