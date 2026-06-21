import type { Completeness } from "@/lib/services/prospect-intel";
import { COMPLETENESS_LABEL } from "@/lib/services/prospect-intel";

/** Brief-completeness pill (low / med / high) with the 3-bar meter. */
export function CompletenessChip({ value }: { value: Completeness }) {
  return (
    <span className={`completeness ${value}`}>
      <span className="bars"><i /><i /><i /></span>
      {COMPLETENESS_LABEL[value]}
    </span>
  );
}
