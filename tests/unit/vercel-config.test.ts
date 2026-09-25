import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Vercel builds this repo with whatever framework it detects. `vitest` pulls
 * `vite` into the dependency tree, and auto-detection has picked Vite over
 * Next.js before — which fails the build with
 * `Could not resolve entry module "index.html"` because there is no Vite app
 * here. `vercel.json` pins the preset so detection can never go wrong.
 */
const vercelConfig = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../vercel.json", import.meta.url)), "utf8"),
) as { framework?: string; buildCommand?: string };

describe("vercel.json", () => {
  it("pins the Next.js framework preset", () => {
    expect(vercelConfig.framework).toBe("nextjs");
  });

  it("builds with next build, not vite build", () => {
    expect(vercelConfig.buildCommand).toBe("next build");
  });
});
