import Link from "next/link";

export function Logo({ href = "/", size = "md" }: { href?: string; size?: "sm" | "md" | "lg" }) {
  const markSize = size === "lg" ? "w-9 h-9 text-lg" : size === "sm" ? "w-7 h-7 text-sm" : "w-8 h-8 text-base";
  const wordSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-lg" : "text-xl";
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 font-display font-semibold">
      <span className={`grid place-items-center rounded bg-dark text-accent ${markSize}`}>O</span>
      <span className={wordSize}>ORO CORPORATE</span>
    </Link>
  );
}
