import Link from "next/link";
import { getBranding } from "@/lib/services/branding";
import { BrandMark } from "@/components/BrandMark";

export async function Footer() {
  const { brandName, brandMark, logo } = await getBranding();
  return (
    <footer className="pubfooter">
      <div className="cols">
        <div>
          <div className="wordmark" style={{ marginBottom: 16 }}>
            <span className="seal" />
            <BrandMark logo={logo} mark={brandMark} />
            <span>{brandName}</span>
          </div>
          <p style={{ maxWidth: "36ch", color: "#8C97B5", fontSize: "0.875rem" }}>
            A qualify-first onboarding platform for corporate-services &amp; fiduciary
            firms. Your brand, your clients, one platform.
          </p>
        </div>
        <div>
          <h4>Platform</h4>
          <Link href="/services">Services</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Start application</Link>
        </div>
        <div>
          <h4>Tools</h4>
          <Link href="/tools/compare">Compare jurisdictions</Link>
          <Link href="/tools/calculator">Tax calculator</Link>
          <Link href="/faq">FAQ</Link>
        </div>
        <div>
          <h4>Access</h4>
          <Link href="/login">Client login</Link>
          <Link href="/login">Admin login</Link>
          <Link href="/login">Apply now</Link>
        </div>
      </div>
      <div className="legal">
        <span>© 2026 {brandName}. EU data residency · GDPR-ready.</span>
        <span className="legal-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </span>
      </div>
    </footer>
  );
}
