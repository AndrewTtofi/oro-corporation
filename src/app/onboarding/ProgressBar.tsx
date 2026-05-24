export function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  const pct = step === 1 ? "33.33%" : step === 2 ? "66.66%" : "100%";
  const labels = ["Service Selection", "Your Details", "Documents"] as const;
  return (
    <div className="py-10 text-center">
      <div className="font-mono text-meta uppercase tracking-widest text-accent">
        Step {step} of 3 · {labels[step - 1]}
      </div>
      <div className="w-[200px] h-1 mx-auto mt-3 rounded-full relative" style={{ background: "var(--border)" }}>
        <div
          className="absolute left-0 top-0 h-full bg-accent rounded-full transition-all duration-500"
          style={{ width: pct }}
        />
      </div>
    </div>
  );
}
