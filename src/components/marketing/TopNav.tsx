import Link from "next/link";
import { getBranding } from "@/lib/services/branding";

export async function TopNav() {
  const { brandName, brandMark } = await getBranding();
  return (
    <nav className="pubnav">
      <div className="pubnav-inner">
        <Link href="/" className="wordmark">
          <span className="seal" />
          <span className="mk">{brandMark}</span>
          <span>{brandName}</span>
        </Link>
        <div className="pubnav-links">
          <Link href="/services">Services</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/tools/compare">Compare</Link>
          <Link href="/tools/calculator">Tax calculator</Link>
          <Link href="/faq">FAQ</Link>
        </div>
        <div className="pubnav-right">
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/login" className="btn btn-primary btn-sm">Get started</Link>
        </div>
      </div>
    </nav>
  );
}
