import next from "eslint-config-next";

/**
 * ESLint flat config, backed by `eslint-config-next` — the official preset and
 * the supported replacement for `next lint`, which Next.js 16 removed.
 *
 * The preset brings the Next.js, React, react-hooks, jsx-a11y and
 * typescript-eslint rule sets. Two additions keep the build honest:
 *
 *  - unused variables are errors: dead code is a correctness signal here, not
 *    a style preference;
 *  - the provider SDKs (`@google/genai`, `razorpay`, `resend`) may not be
 *    imported outside `src/server/**`, so a server-only SDK can never sneak
 *    into a Client Component bundle by accident — the supported path is the
 *    typed service layer in `src/server/services/*`.
 */

export default [
  ...next,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          // `_arg` is the established convention for an intentionally unused
          // parameter (e.g. a uniform withRoute handler signature).
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@google/genai", "@google/genai/*", "razorpay", "razorpay/*", "resend", "resend/*"],
              message:
                "Provider SDKs are server-only. Import from the typed services in src/server/services instead.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "scraper/**",
      "scripts/**",
      "tests/**",
      "next.config.ts",
      "eslint.config.mjs",
    ],
  },
];
