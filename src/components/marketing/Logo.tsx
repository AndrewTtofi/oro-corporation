import Link from "next/link";
import { getBranding } from "@/lib/services/branding";

export async function Logo({ href = "/", size = "md" }: { href?: string; size?: "sm" | "md" | "lg" }) {
  const { brandName, brandMark } = await getBranding();
  const mk = size === "lg" ? 32 : size === "sm" ? 24 : 28;
  const word = size === "lg" ? "1.563rem" : size === "sm" ? "1.125rem" : "1.25rem";
  return (
    <Link href={href} className="wordmark" style={{ fontSize: word }}>
      <span className="seal" />
      <span className="mk" style={{ width: mk, height: mk }}>{brandMark}</span>
      <span>{brandName}</span>
    </Link>
  );
}
