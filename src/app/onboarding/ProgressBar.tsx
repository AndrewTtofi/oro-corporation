export function ProgressBar({ step, totalSteps = 3 }: { step: number; totalSteps?: number }) {
  const labels =
    totalSteps === 2
      ? (["Service Selection", "Your Details"] as const)
      : (["Service Selection", "Your Details", "Documents"] as const);
  const pct = `${Math.min(100, (step / totalSteps) * 100)}%`;
  return (
    <div className="py-10 text-center">
      <div className="font-mono text-meta uppercase tracking-widest" style={{ color: "var(--brand)" }}>
        Step {step} of {totalSteps} · {labels[step - 1]}
      </div>
      <div className="w-[200px] h-1 mx-auto mt-3 rounded-full relative" style={{ background: "var(--border)" }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: pct, background: "var(--brand)" }}
        />
      </div>
    </div>
  );
}
