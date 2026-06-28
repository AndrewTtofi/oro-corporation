import Link from "next/link";
import { getBranding } from "@/lib/services/branding";
import { BrandMark } from "@/components/BrandMark";

export async function TopNav() {
  const { brandName, brandMark, logo } = await getBranding();
  return (
    <nav className="pubnav">
      <div className="pubnav-inner">
        <Link href="/" className="wordmark">
          <span className="seal" />
          <BrandMark logo={logo} mark={brandMark} />
          <span>{brandName}</span>
        </Link>
        <div className="pubnav-links">
          <Link href="/services">Services</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/marketplace">Partner network</Link>
          <Link href="/tools/compare">Compare</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/advisor">Advisor <span className="badge badge-new" style={{ marginLeft: 4 }}>AI</span></Link>
        </div>
        <div className="pubnav-right">
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/login" className="btn btn-primary btn-sm">Get started</Link>
        </div>
      </div>
    </nav>
  );
}
