import Link from "next/link";

export function Logo({ href = "/", size = "md" }: { href?: string; size?: "sm" | "md" | "lg" }) {
  const mk = size === "lg" ? 32 : size === "sm" ? 24 : 28;
  const word = size === "lg" ? "1.563rem" : size === "sm" ? "1.125rem" : "1.25rem";
  return (
    <Link href={href} className="wordmark" style={{ fontSize: word }}>
      <span className="seal" />
      <span className="mk" style={{ width: mk, height: mk }}>O</span>
      <span>ORO</span>
    </Link>
  );
}
