import Link from "next/link";
import { getBranding } from "@/lib/services/branding";
import { BrandMark } from "@/components/BrandMark";

export async function Logo({ href = "/", size = "md" }: { href?: string; size?: "sm" | "md" | "lg" }) {
  const { brandName, brandMark, logo } = await getBranding();
  const mk = size === "lg" ? 32 : size === "sm" ? 24 : 28;
  const word = size === "lg" ? "1.563rem" : size === "sm" ? "1.125rem" : "1.25rem";
  return (
    <Link href={href} className="wordmark" style={{ fontSize: word }}>
      <span className="seal" />
      <BrandMark logo={logo} mark={brandMark} style={{ width: mk, height: mk }} />
      <span>{brandName}</span>
    </Link>
  );
}
