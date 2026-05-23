import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedPrefixes: { prefix: string; roles: string[] }[] = [
  { prefix: "/app",     roles: ["prospect", "client", "staff", "partner"] },
  { prefix: "/admin",   roles: ["staff"] },
  { prefix: "/partner", roles: ["partner"] },
  { prefix: "/onboarding", roles: ["prospect", "client", "staff"] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const guard = protectedPrefixes.find((g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`));
  if (!guard) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!guard.roles.includes(String(token.role))) {
    // Hide the existence of admin/partner surfaces from the wrong role.
    return NextResponse.rewrite(new URL("/404", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/partner/:path*", "/onboarding/:path*"],
};
