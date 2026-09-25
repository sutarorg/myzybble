"use client";

import Link from "@/components/marketing/LinkCompat";
import { ArrowRight, ArrowUpRight, Map, ShieldCheck, MailOpen, Clock3 } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "@/components/marketing/PageShell";
import { Reveal } from "@/components/marketing/ui";
import { POSTS, type Post } from "@/data/posts";
import { cn } from "@/lib/cn";

const COVER_ICONS = { map: Map, shield: ShieldCheck, mail: MailOpen } as const;

/* crafted CSS cover for posts without AI imagery */
export function Cover({ post, large = false }: { post: Post; large?: boolean }) {
  const Icon = COVER_ICONS[post.coverIcon];
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-ink", large ? "min-h-[260px]" : "min-h-[200px]")}>
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(245,243,236,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,243,236,0.05)_1px,transparent_1px)] bg-[size:34px_34px]"
        aria-hidden
      />
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-lime/15 blur-3xl" aria-hidden />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <span className="absolute -inset-6 rounded-full border border-lime/25" aria-hidden />
          <span className="absolute -inset-12 rounded-full border border-lime/10" aria-hidden />
          <span className="relative grid h-20 w-20 place-items-center rounded-full border border-lime/40 bg-ink-2">
            <Icon className="h-9 w-9 text-lime" strokeWidth={1.5} />
          </span>
        </div>
      </div>
      <span className="absolute bottom-4 left-5 rounded-full bg-lime px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
        {post.category}
      </span>
      <span className="absolute bottom-4 right-5 font-mono text-[10px] text-paper/40">{post.readMins} min read</span>
    </div>
  );
}

export function PostMeta({ post, light = false }: { post: Post; light?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]", light ? "text-paper/50" : "text-ink/45")}>
      <span className="flex items-center gap-1.5">
        <span className={cn("grid h-6 w-6 place-items-center rounded-full font-display text-[10px] font-bold", light ? "bg-lime text-ink" : "bg-ink text-lime")}>
          {post.author.initials}
        </span>
        {post.author.name}
      </span>
      <span>{post.date}</span>
      <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{post.readMins} min</span>
    </div>
  );
}

export default function BlogIndex() {
  usePageMeta(
    "Blog — zybble | Lead generation playbooks & guides",
    "Playbooks and guides on Google Maps lead generation, compliant data extraction, and cold outreach that books meetings.",
  );
  const [featured, ...rest] = POSTS;

  return (
    <main>
      <PageHero
        tag="The zybble blog"
        title={
          <>
            Pipeline <Mark>playbooks</Mark>, not platitudes
          </>
        }
        sub="Deep guides on Google Maps lead generation, compliance, and cold outreach — written by the people who ship the product and run the campaigns."
      />

      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          {/* featured */}
          <Reveal>
            <Link
              to={`/blog/${featured.slug}`}
              className="group grid overflow-hidden rounded-3xl border border-ink/10 bg-white/70 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_40px_90px_-30px_rgba(11,16,14,0.3)] lg:grid-cols-2"
            >
              <div className="relative overflow-hidden">
                <img
                  src={featured.hero ?? undefined}
                  alt={featured.title}
                  className="h-full min-h-[260px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <span className="absolute left-5 top-5 rounded-full bg-lime px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
                  featured · {featured.category}
                </span>
              </div>
              <div className="flex flex-col justify-between p-7 sm:p-10">
                <div>
                  <PostMeta post={featured} />
                  <h2 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight sm:text-[2rem]">
                    {featured.title}
                  </h2>
                  <p className="mt-3.5 line-clamp-3 leading-relaxed text-ink/60">{featured.excerpt}</p>
                </div>
                <span className="mt-7 inline-flex items-center gap-2 font-mono text-xs font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4">
                  read the guide
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </Link>
          </Reveal>

          {/* rest */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {rest.map((p, i) => (
              <Reveal key={p.slug} delay={0.08 * (i + 1)}>
                <Link
                  to={`/blog/${p.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border border-ink/10 bg-white/70 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_32px_70px_-28px_rgba(11,16,14,0.28)]"
                >
                  <div className="transition-transform duration-700 group-hover:scale-[1.01]">
                    <Cover post={p} />
                  </div>
                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <PostMeta post={p} />
                    <h2 className="mt-3.5 font-display text-xl font-bold leading-snug tracking-tight sm:text-2xl">
                      {p.title}
                    </h2>
                    <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-ink/60">{p.excerpt}</p>
                    <span className="mt-auto pt-5 font-mono text-xs font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4">
                      read article →
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          {/* newsletter */}
          <Reveal className="mt-12">
            <NewsletterForm />
          </Reveal>
        </div>
      </section>
    </main>
  );
}

export function NewsletterForm() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink p-8 text-paper sm:p-12">
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(245,243,236,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,243,236,0.04)_1px,transparent_1px)] bg-[size:38px_38px]"
        aria-hidden
      />
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-lime/15 blur-3xl" aria-hidden />
      <div className="relative flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
        <div className="max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-lime">the pipeline post</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            One playbook in your inbox, every Tuesday
          </h2>
          <p className="mt-3 text-paper/60">
            The same tactics our customers use to book 6.2× more meetings — no fluff, unsubscribe anytime.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const btn = e.currentTarget.querySelector("button");
            if (btn) btn.textContent = "You're in ✓";
          }}
          className="flex w-full max-w-md gap-2 rounded-full border border-white/15 bg-white/[0.06] p-1.5 backdrop-blur"
        >
          <input
            type="email"
            required
            placeholder="you@company.com"
            className="min-w-0 flex-1 bg-transparent px-4 text-sm text-paper placeholder:text-paper/35 outline-none"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-lime px-5 py-3 text-sm font-bold text-ink transition-shadow hover:shadow-[0_0_30px_rgba(216,255,62,0.5)]"
          >
            Subscribe
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
