import Link from "next/link";
import { Logo } from "./Logo";

export function TopNav() {
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: "color-mix(in oklch, var(--bg) 95%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="container flex items-center justify-between py-5">
        <Logo size="md" />
        <nav className="hidden md:flex items-center gap-10 text-[15px] font-medium">
          <Link href="/#why" className="hover:text-accent transition-colors">Why Cyprus</Link>
          <Link href="/#services" className="hover:text-accent transition-colors">Services</Link>
          <Link href="/#how" className="hover:text-accent transition-colors">How It Works</Link>
        </nav>
        <Link href="/login" className="btn btn-accent px-7 py-3.5">Start Application</Link>
      </div>
    </header>
  );
}
