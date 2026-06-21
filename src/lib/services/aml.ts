/* Deterministic mock AML screening result, keyed by reference. In production
   this wraps a third-party screening API (sanctions / PEP / adverse media). */
export type AmlResult = {
  sanctions: "clear" | "match";
  pep: "clear" | "match";
  adverse: "clear" | "flag";
  risk: "low" | "medium" | "high";
};

export function amlResult(ref: string): AmlResult {
  const hash = [...ref].reduce((a, c) => a + c.charCodeAt(0), 0);
  const pep = hash % 4 === 0;
  const adverse = hash % 6 === 0;
  return {
    sanctions: "clear",
    pep: pep ? "match" : "clear",
    adverse: adverse ? "flag" : "clear",
    risk: pep && adverse ? "high" : pep || adverse ? "medium" : "low",
  };
}
