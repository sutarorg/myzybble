import Link from "@/components/marketing/LinkCompat";
import { Logo } from "@/components/marketing/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="px-5 py-5 sm:px-10">
        <Link to="/" aria-label="zybble home">
          <Logo />
        </Link>
      </div>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-24">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/40">Error 404</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
          This page moved off the map
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/60">
          The link you followed doesn&apos;t exist — or it was renamed. Try one of these instead.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
          >
            Go to dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex items-center rounded-full border border-ink/15 px-6 py-3 text-sm font-semibold text-ink"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}

export const metadata = { title: "Page not found — zybble", robots: { index: false, follow: false } };
