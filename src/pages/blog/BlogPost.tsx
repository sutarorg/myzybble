import { Link, useParams } from "react-router-dom";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Lightbulb, Quote } from "lucide-react";
import { usePageMeta, Mark } from "../../components/PageShell";
import { Reveal } from "../../components/ui";
import { getPost, POSTS, type Block } from "../../data/posts";
import { Cover, PostMeta, NewsletterForm } from "./BlogIndex";
import { CTA } from "../../components/Footer";

function BlockRenderer({ b }: { b: Block }) {
  switch (b.t) {
    case "h2":
      return (
        <h2 className="mt-12 font-display text-2xl font-bold tracking-tight sm:text-3xl">{b.text}</h2>
      );
    case "p":
      return <p className="mt-5 text-[1.05rem] leading-[1.85] text-ink/75">{b.text}</p>;
    case "quote":
      return (
        <figure className="mt-8 rounded-2xl border-l-4 border-lime bg-ink p-6 text-paper sm:p-7">
          <Quote className="h-5 w-5 text-lime" />
          <blockquote className="mt-3 text-[0.98rem] leading-[1.8] text-paper/85">{b.text}</blockquote>
          {b.by && <figcaption className="mt-4 font-mono text-xs text-lime/80">{b.by}</figcaption>}
        </figure>
      );
    case "list":
      return (
        <ul className="mt-6 space-y-3.5">
          {b.items.map((it) => (
            <li key={it.slice(0, 24)} className="flex items-start gap-3.5 text-[1rem] leading-relaxed text-ink/75">
              <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime">
                <Check className="h-3 w-3 text-ink" strokeWidth={3.5} />
              </span>
              {it}
            </li>
          ))}
        </ul>
      );
    case "image":
      return (
        <figure className="mt-10">
          <img src={b.src} alt={b.alt} className="w-full rounded-2xl border border-ink/10 shadow-[0_30px_70px_-30px_rgba(11,16,14,0.35)]" loading="lazy" />
          <figcaption className="mt-3 flex items-start gap-2 font-mono text-xs leading-relaxed text-ink/45">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-2" />
            {b.caption}
          </figcaption>
        </figure>
      );
    case "stat":
      return (
        <div className="mt-9 flex items-center gap-6 rounded-2xl border border-lime/25 bg-lime/[0.07] px-7 py-6">
          <span className="font-display text-5xl font-bold tracking-tight text-lime-2 sm:text-6xl">{b.stat}</span>
          <span className="max-w-xs font-mono text-xs leading-relaxed text-ink/60">{b.label}</span>
        </div>
      );
    case "callout":
      return (
        <div className="mt-8 flex items-start gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-[0_18px_44px_-20px_rgba(11,16,14,0.15)] sm:p-7">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime">
            <Lightbulb className="h-5 w-5 text-ink" />
          </span>
          <div>
            <p className="font-display text-lg font-bold tracking-tight">{b.title}</p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/65">{b.text}</p>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export default function BlogPost() {
  const { slug } = useParams();
  const post = getPost(slug ?? "") ?? POSTS[0];
  const others = POSTS.filter((p) => p.slug !== post.slug);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });

  usePageMeta(`${post.title} — zybble blog`, post.excerpt);

  return (
    <main className="pt-28 sm:pt-32">
      {/* reading progress */}
      <motion.div
        className="fixed inset-x-0 top-0 z-[70] h-1 origin-left bg-lime"
        style={{ scaleX: progress }}
        aria-hidden
      />

      <article className="mx-auto max-w-3xl px-5 lg:px-0">
        <Reveal>
          <Link to="/blog" className="group inline-flex items-center gap-1.5 font-mono text-xs text-ink/50 transition-colors hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            all articles
          </Link>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-lime px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
              {post.category}
            </span>
            <PostMeta post={post} />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold leading-[1.12] tracking-[-0.02em] sm:text-[2.75rem]">
            {post.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink/60">{post.excerpt}</p>
        </Reveal>

        {/* hero */}
        <Reveal delay={0.15} className="mt-10">
          {post.hero ? (
            <img
              src={post.hero}
              alt={post.title}
              className="w-full rounded-3xl border border-ink/10 shadow-[0_40px_90px_-35px_rgba(11,16,14,0.4)]"
            />
          ) : (
            <div className="overflow-hidden rounded-3xl border border-ink/10">
              <Cover post={post} large />
            </div>
          )}
        </Reveal>

        {/* keywords */}
        <Reveal delay={0.2}>
          <div className="mt-7 flex flex-wrap gap-2">
            {post.keywords.map((k) => (
              <span key={k} className="rounded-full border border-ink/12 bg-white/60 px-3 py-1 font-mono text-[10.5px] text-ink/50">
                #{k.replace(/\s+/g, "-")}
              </span>
            ))}
          </div>
        </Reveal>

        {/* content */}
        <div className="mt-4 pb-4">
          {post.content.map((b, i) => (
            <BlockRenderer key={i} b={b} />
          ))}
        </div>

        {/* author */}
        <Reveal>
          <div className="mt-12 flex items-center gap-4 rounded-2xl border border-ink/10 bg-white/70 p-6">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-bold text-lime">
              {post.author.initials}
            </span>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">{post.author.name}</p>
              <p className="font-mono text-xs text-ink/50">{post.author.role}</p>
              <p className="mt-1.5 text-sm text-ink/60">
                Writes from real campaign data across 2,300+ zybble workspaces.
              </p>
            </div>
          </div>
        </Reveal>
      </article>

      {/* related */}
      <section className="mx-auto max-w-6xl px-5 pb-8 pt-16 lg:px-8">
        <Reveal className="flex items-end justify-between gap-6">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em]">
            Keep <Mark>reading</Mark>
          </h2>
          <Link to="/blog" className="group hidden items-center gap-1.5 font-mono text-xs text-ink/50 hover:text-ink sm:flex">
            view all <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </Reveal>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {others.map((p, i) => (
            <Reveal key={p.slug} delay={0.08 * i}>
              <Link
                to={`/blog/${p.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-ink/10 bg-white/70 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_32px_70px_-28px_rgba(11,16,14,0.28)]"
              >
                {p.hero ? (
                  <img src={p.hero} alt={p.title} className="h-44 w-full object-cover" />
                ) : (
                  <Cover post={p} />
                )}
                <div className="flex flex-1 flex-col p-6">
                  <PostMeta post={p} />
                  <h3 className="mt-3 font-display text-lg font-bold leading-snug tracking-tight">{p.title}</h3>
                  <span className="mt-auto pt-4 flex items-center gap-1.5 font-mono text-xs text-ink/50 group-hover:text-ink">
                    read article <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-12">
          <NewsletterForm />
        </Reveal>
      </section>

      <CTA />
    </main>
  );
}
