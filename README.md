# zybble — SaaS landing & marketing site

Google Maps lead-generation platform site: landing page, auth, product pages,
use-case pages, blog (SEO articles + AI imagery), legal docs and an interactive
slider-based pricing UI.

Built with **React 19 · Vite 7 · Tailwind CSS 4 · Framer Motion · React Router**,
bundled as a single-file static build via `vite-plugin-singlefile`.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build    # outputs dist/index.html (self-contained single file)
npm run preview  # serve the production build locally
```

## Deploy to Vercel

The repo is pre-configured with `vercel.json` (framework detection, SPA rewrites
for React Router, and cache headers). Deep links like `/pricing` or `/blog/*`
work out of the box.

**Option A — Dashboard (recommended):**

1. Push this repo to GitHub / GitLab / Bitbucket.
2. In Vercel → **Add New → Project** → import the repo.
3. Vercel detects Vite automatically (`build: npm run build`, output: `dist`).
4. Click **Deploy**. Done — no extra settings needed.

**Option B — CLI:**

```bash
npm i -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

Notes:
- Routing is client-side (`BrowserRouter`); `vercel.json` rewrites all paths to
  `index.html`, which is **required** for direct URL access/refresh.
- No environment variables are required for the static build.
