import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Mail, LifeBuoy, Megaphone, ChevronDown, Timer, MapPin } from "lucide-react";
import { PageHero, usePageMeta, Mark } from "../components/PageShell";
import { Reveal, SectionTag, EASE } from "../components/ui";
import { inputCls } from "../components/AuthShell";
import { cn } from "../utils/cn";

const CHANNELS = [
  { icon: Mail, t: "Sales & demos", a: "sales@zybble.io", d: "Pricing, volume plans, demos, procurement." },
  { icon: LifeBuoy, t: "Support", a: "support@zybble.io", d: "Product help, billing, data questions. Median first reply: 47 min." },
  { icon: Megaphone, t: "Press & partners", a: "press@zybble.io", d: "Media, podcasts, integrations, co-marketing." },
];

const TOPICS = ["Sales inquiry", "Product support", "Partnership", "Press", "Careers", "Something else"];

export default function Contact() {
  usePageMeta(
    "Contact — zybble",
    "Talk to the zybble team: sales, support, partnerships and press. Median first reply under an hour.",
  );
  const [form, setForm] = useState({ name: "", email: "", company: "", topic: TOPICS[0], msg: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Your name is required.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "A valid email is required.";
    if (form.msg.trim().length < 10) next.msg = "Tell us a little more (10+ characters).";
    setErrs(next);
    if (Object.keys(next).length === 0) setSent(true);
  };

  return (
    <main>
      <PageHero
        tag="Contact"
        title={
          <>
            Talk to a <Mark>human</Mark>. Fast.
          </>
        }
        sub="Sales, support, partnerships, or just a question about data quality — median first reply is 47 minutes during business hours."
      />

      <section className="pb-24">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12">
            {/* channels */}
            <div className="space-y-4 lg:col-span-5">
              {CHANNELS.map((c, i) => (
                <Reveal key={c.t} delay={0.06 * i}>
                  <a href={`mailto:${c.a}`} className="group flex items-start gap-4 rounded-3xl border border-ink/10 bg-white/70 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-ink/30 hover:shadow-[0_20px_50px_-20px_rgba(11,16,14,0.2)]">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-lime transition-transform duration-500 group-hover:-rotate-6">
                      <c.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold tracking-tight">{c.t}</h3>
                      <p className="mt-1 font-mono text-sm text-lime-2 underline decoration-lime decoration-2 underline-offset-4">{c.a}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink/55">{c.d}</p>
                    </div>
                  </a>
                </Reveal>
              ))}
              <Reveal delay={0.2}>
                <div className="rounded-3xl bg-ink p-6 text-paper">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime/15 text-lime">
                      <Timer className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold tracking-tight">Response times</h3>
                      <p className="font-mono text-xs text-paper/50">mon–fri · 8:00–18:00 CET</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      { l: "support", v: "47 min median" },
                      { l: "sales", v: "under 2 hours" },
                      { l: "partnerships", v: "same day" },
                    ].map((r) => (
                      <div key={r.l} className="flex justify-between border-b border-white/10 pb-2.5 font-mono text-xs last:border-0 last:pb-0">
                        <span className="text-paper/50">{r.l}</span>
                        <span className="text-lime">{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.25}>
                <p className="flex items-center gap-2 px-2 font-mono text-xs text-ink/45">
                  <MapPin className="h-4 w-4 text-lime-2" />
                  remote-first · HQ Austin, TX · registered in DE, USA
                </p>
              </Reveal>
            </div>

            {/* form */}
            <Reveal delay={0.1} className="lg:col-span-7">
              <div className="rounded-3xl border border-ink/10 bg-white/70 p-7 sm:p-9">
                {sent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="flex min-h-[26rem] flex-col items-center justify-center text-center"
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-lime">
                      <Check className="h-8 w-8 text-ink" strokeWidth={3} />
                    </span>
                    <h2 className="mt-6 font-display text-3xl font-bold tracking-tight">Message received</h2>
                    <p className="mt-3 max-w-sm text-ink/60">
                      Thanks, {form.name.split(" ")[0] || "friend"} — a human will reply to{" "}
                      <span className="font-mono text-ink">{form.email}</span> shortly. Ticket{" "}
                      <span className="font-mono text-lime-2">#ZY-4821</span> opened.
                    </p>
                    <Link to="/" className="mt-7 rounded-full border border-ink/15 px-6 py-3 text-sm font-semibold transition-colors hover:border-ink/40">
                      Back to site
                    </Link>
                  </motion.div>
                ) : (
                  <form onSubmit={submit} noValidate>
                    <SectionTag>Send a message</SectionTag>
                    <div className="mt-6 grid gap-5 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 flex justify-between font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
                          Name {errs.name && <span className="normal-case tracking-normal text-red-500">{errs.name}</span>}
                        </span>
                        <input value={form.name} onChange={set("name")} placeholder="Alex Rivera" className={cn(inputCls, errs.name && "border-red-400")} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 flex justify-between font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
                          Email {errs.email && <span className="normal-case tracking-normal text-red-500">{errs.email}</span>}
                        </span>
                        <input type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" className={cn(inputCls, errs.email && "border-red-400")} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">Company (optional)</span>
                        <input value={form.company} onChange={set("company")} placeholder="Acme Inc." className={inputCls} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">Topic</span>
                        <div className="relative">
                          <select value={form.topic} onChange={set("topic")} className={cn(inputCls, "appearance-none pr-11")}>
                            {TOPICS.map((t) => <option key={t}>{t}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink/40" />
                        </div>
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-1.5 flex justify-between font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">
                          Message {errs.msg && <span className="normal-case tracking-normal text-red-500">{errs.msg}</span>}
                        </span>
                        <textarea
                          value={form.msg}
                          onChange={set("msg")}
                          rows={6}
                          placeholder="Tell us about your use case, timeline, or question…"
                          className={cn(inputCls, "resize-none", errs.msg && "border-red-400")}
                        />
                      </label>
                    </div>
                    <div className="mt-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <p className="font-mono text-[11px] leading-relaxed text-ink/40">
                        by sending you agree to our{" "}
                        <Link to="/privacy" className="underline underline-offset-2 hover:text-ink">privacy policy</Link>
                      </p>
                      <button type="submit" className="group inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 font-semibold text-paper transition-all hover:bg-ink-3 hover:shadow-[0_16px_44px_rgba(11,16,14,0.28)]">
                        Send message
                        <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  );
}
