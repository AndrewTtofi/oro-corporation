import Link from "next/link";

export function Footer() {
  return (
    <footer className="pubfooter">
      <div className="cols">
        <div>
          <div className="wordmark" style={{ marginBottom: 16 }}>
            <span className="seal" />
            <span className="mk">O</span>
            <span>ORO</span>
          </div>
          <p style={{ maxWidth: "36ch", color: "#8C97B5", fontSize: "0.875rem" }}>
            Private corporate counsel for international principals. Incorporation,
            tax residency, banking and fiduciary administration from Cyprus.
          </p>
        </div>
        <div>
          <h4>Services</h4>
          <Link href="/services">Company formation</Link>
          <Link href="/services">Tax residency</Link>
          <Link href="/services">Immigration</Link>
          <Link href="/services">Banking</Link>
        </div>
        <div>
          <h4>Platform</h4>
          <Link href="/#how">How it works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/login">Start application</Link>
        </div>
        <div>
          <h4>Access</h4>
          <Link href="/login">Client login</Link>
          <Link href="/login">Admin login</Link>
          <Link href="/login">Apply now</Link>
        </div>
      </div>
      <div className="legal">
        <span>© 2026 ORO Corporate Services Limited.</span>
        <span style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <span>EU data residency · GDPR-ready</span>
        </span>
      </div>
    </footer>
  );
}
