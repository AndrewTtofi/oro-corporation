import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-dark text-white" style={{ color: "var(--client-bg)" }}>
      <div className="container py-16">
        <div className="grid gap-16 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="mb-6"><Logo /></div>
            <p className="max-w-[32ch] opacity-60 text-[15px]">
              A leading fiduciary firm providing bespoke corporate and individual solutions for an international clientele.
            </p>
          </div>
          <div>
            <h4 className="font-body text-meta uppercase tracking-widest text-accent mb-6">Services</h4>
            <ul className="flex flex-col gap-3 text-[15px] opacity-60">
              <li><a href="#services">Company Formation</a></li>
              <li><a href="#services">Tax Residency</a></li>
              <li><a href="#services">Immigration</a></li>
              <li><a href="#services">Banking</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-body text-meta uppercase tracking-widest text-accent mb-6">Contact</h4>
            <ul className="flex flex-col gap-3 text-[15px] opacity-60">
              <li>Stadiou 15, Nicosia, Cyprus</li>
              <li>+357 22 037 060</li>
              <li>info@orocorporateservices.com</li>
            </ul>
          </div>
        </div>
        <div className="mt-16 pt-8 border-t border-white/10 flex justify-between flex-wrap gap-3 text-meta opacity-60">
          <span>© 2026 ORO Corporate Services Limited. All rights reserved.</span>
          <span>Privacy Policy · Terms of Service</span>
        </div>
      </div>
    </footer>
  );
}
