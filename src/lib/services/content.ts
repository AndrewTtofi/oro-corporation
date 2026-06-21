import { cache } from "react";
import { prisma } from "@/lib/db";

/* =====================================================================
   Editable marketing-site content (landing + FAQ).
   Stored as a singleton JSON blob and merged over these code defaults, so
   the public pages always render even before anything is edited, and new
   fields added later degrade gracefully.
   ===================================================================== */

export type Step = { t: string; d: string };
export type Stat = { v: string; l: string };
export type Testimonial = { q: string; n: string; r: string };
export type Faq = { q: string; a: string };

export type SiteContent = {
  hero: { eyebrow: string; headline: string; lead: string; primaryCta: string; secondaryCta: string };
  steps: Step[];
  servicesIntro: { eyebrow: string; heading: string; body: string };
  stats: Stat[];
  testimonialsIntro: { eyebrow: string; heading: string };
  testimonials: Testimonial[];
  cta: { heading: string; body: string; button: string };
  faq: Faq[];
};

export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    eyebrow: "CORPORATE SERVICES · CYPRUS",
    headline: "Your Cyprus company, handled end to end.",
    lead: "Incorporation, tax residency, banking and ongoing compliance — set up and run from one branded platform, with a dedicated advisor and full visibility at every step.",
    primaryCta: "Start an application →",
    secondaryCta: "Explore services",
  },
  steps: [
    { t: "Apply", d: "Create an account and submit your details and documents through a short, guided application — tailored to the services you need." },
    { t: "Review", d: "Our compliance team reviews each application with KYC and sanctions screening, then approves — usually within one business day." },
    { t: "Onboard", d: "Once approved you unlock booking and a full workspace: documents, messaging, deadlines and your dedicated advisor." },
  ],
  servicesIntro: {
    eyebrow: "WHAT WE HANDLE",
    heading: "One platform across the whole engagement.",
    body: "Six core corporate-services lines, each with its own guided intake and required-document logic.",
  },
  stats: [
    { v: "150+", l: "Companies incorporated" },
    { v: "4.9★", l: "Client rating · 87 reviews" },
    { v: "25+", l: "Banking relationships" },
  ],
  testimonialsIntro: { eyebrow: "IN THEIR WORDS", heading: "Principals run their setup on it." },
  testimonials: [
    { q: "Incorporated and banked in under three weeks. The portal made the document back-and-forth painless.", n: "Daniel Roth", r: "Founder, fintech · Germany" },
    { q: "Finally a corporate-services firm that feels like software. I always knew exactly what was outstanding.", n: "Aisha Karim", r: "Director · UAE" },
    { q: "Tax residency and banking handled together, with one point of contact. Exactly what we needed relocating.", n: "Elena Pappas", r: "Private client · Cyprus" },
  ],
  cta: {
    heading: "Start your application today.",
    body: "An initial consultation is offered without obligation. Submit a brief application and counsel will be in touch within one business day.",
    button: "Start an application →",
  },
  faq: [
    { q: "Why do I submit documents before booking a call?", a: "The gate ensures every consultation is with a serious, pre-qualified prospect. It also means your advisor walks into the call already knowing your situation — no time wasted on basics." },
    { q: "Where is my data stored?", a: "All data — including identity documents and financial information — is encrypted and stored within the EU, with GDPR-compliant data-portability and exit terms." },
    { q: "How long does review take?", a: "Typically 1–3 business days. You are notified by email (and WhatsApp, if enabled) the moment your application is approved and booking unlocks." },
    { q: "What happens to my information if I do not proceed?", a: "You can request export or deletion of your records at any time. Nothing is shared with third parties without your consent." },
    { q: "Which services can I apply for?", a: "Company formation, accounting & tax, tax residency, immigration, licensing and banking. Each has a tailored intake form so you only answer relevant questions." },
    { q: "How is pricing structured?", a: "Three engagements — Essentials, Standard and Full service — billed as a setup fee plus a monthly retainer, or a custom quote. See the pricing page for a full comparison." },
  ],
};

/** Merge a stored partial over the defaults: objects merge per-field; arrays
 *  replace entirely when present (so an editor can shorten a list). */
function merge(stored: Partial<SiteContent> | null | undefined): SiteContent {
  const s = stored ?? {};
  const obj = <T,>(key: keyof SiteContent): T =>
    ({ ...(DEFAULT_CONTENT[key] as object), ...((s[key] as object) ?? {}) }) as T;
  const arr = <T,>(key: keyof SiteContent): T[] =>
    (Array.isArray(s[key]) ? (s[key] as T[]) : (DEFAULT_CONTENT[key] as T[]));
  return {
    hero: obj("hero"),
    steps: arr<Step>("steps"),
    servicesIntro: obj("servicesIntro"),
    stats: arr<Stat>("stats"),
    testimonialsIntro: obj("testimonialsIntro"),
    testimonials: arr<Testimonial>("testimonials"),
    cta: obj("cta"),
    faq: arr<Faq>("faq"),
  };
}

/** Effective marketing content (stored overrides merged over defaults). Cached
 *  per request so the landing page and FAQ share a single read. */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const row = await prisma.siteContent.findUnique({ where: { id: "singleton" } });
  return merge(row?.data as Partial<SiteContent> | undefined);
});
