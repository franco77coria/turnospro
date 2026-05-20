import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".design-reference/**",
  ]),
  {
    rules: {
      // Async data-fetching functions called inside useEffect is a common
      // React pattern in this codebase. Downgrade to warning.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);

export default eslintConfig;
