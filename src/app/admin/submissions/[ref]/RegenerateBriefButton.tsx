"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** Re-derives the AI brief from the latest data on file. The brief is
 *  deterministic, so this refreshes it against any new documents/answers. */
export function RegenerateBriefButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="btn btn-ghost btn-sm"
    >
      {pending ? "Regenerating…" : "Regenerate"}
    </button>
  );
}
