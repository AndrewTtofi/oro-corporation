// Flat config (ESLint 9+/10). Replaces the legacy `.eslintrc.json` +
// `next lint`, both removed in Next 16 / ESLint 10. `eslint-config-next`
// ships its rules as a flat-config array, so we spread it directly.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      ".next/**",
      "dist-worker/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  {
    // eslint-config-next 16 turns on the new React Compiler ruleset (react-hooks
    // v6). These weren't enforced under Next 15 and currently flag ~37 existing
    // call sites. Demote them to warnings so the framework upgrade doesn't bundle
    // a large behavioural cleanup; addressing them is tracked as follow-up work.
    rules: {
      "react-hooks/static-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default config;
