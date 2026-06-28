/** Shared centered intro for every onboarding phase, so step 1, 2 and 3 share
 *  the same heading font, size and colour treatment. */
export function PhaseIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center max-w-[640px] mx-auto px-4 mb-12">
      <h1 className="font-display text-4xl mb-3">{title}</h1>
      <p className="text-muted text-lg">{subtitle}</p>
    </div>
  );
}
