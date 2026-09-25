import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import AuthShell, { Field, inputCls } from "../../components/AuthShell";
import { EASE } from "../../components/ui";
import { cn } from "../../utils/cn";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABEL = ["too weak", "weak", "okay", "strong", "elite"];

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [errs, setErrs] = useState<{ name?: string; email?: string; pw?: string }>({});
  const [done, setDone] = useState(false);
  const s = strength(pw);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errs = {};
    if (name.trim().length < 2) next.name = "required";
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "valid email required";
    if (pw.length < 8) next.pw = "min 8 characters";
    setErrs(next);
    if (Object.keys(next).length === 0) setDone(true);
  };

  return (
    <AuthShell
      title="Create your account — zybble"
      meta="Start free with zybble: 100 verified Google Maps leads — email & phone data, CSV export, AI Assistant and Campaigns included."
      heading="Claim your 100 free leads"
      sub="Free forever · every feature included · no credit card."
      foot={
        <p className="text-center text-sm text-ink/55">
          Already have an account?{" "}
          <Link to="/signin" className="font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-4">
            Sign in
          </Link>
        </p>
      }
    >
      {done ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="rounded-2xl border border-ink/10 bg-white/70 p-8 text-center"
        >
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lime">
            <Sparkles className="h-7 w-7 text-ink" />
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">Check your inbox, {name.split(" ")[0] || "friend"}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/55">
            We sent a magic link to <span className="font-mono font-medium text-ink">{email}</span>. Your{" "}
            <span className="font-semibold text-ink">100 free leads</span> are waiting inside.
          </p>
          <p className="mt-4 rounded-xl bg-ink px-4 py-3 font-mono text-xs text-lime">
            +100 lead credits · full platform unlocked
          </p>
        </motion.div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="space-y-4">
            <Field label="Full name" error={errs.name}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" className={inputCls} autoComplete="name" />
            </Field>
            <Field label="Work email" error={errs.email}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputCls} autoComplete="email" />
            </Field>
            <Field label="Password" error={errs.pw}>
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8+ characters" className={inputCls} autoComplete="new-password" />
              <div className="mt-2 flex items-center gap-2">
                <div className="flex flex-1 gap-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors duration-300",
                        pw.length === 0 ? "bg-ink/10" : i <= s ? (s >= 3 ? "bg-lime-2" : "bg-ink/40") : "bg-ink/10",
                      )}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink/45">
                  {pw.length === 0 ? "strength" : STRENGTH_LABEL[s]}
                </span>
              </div>
            </Field>
          </div>

          <button
            type="submit"
            className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-lime py-3.5 font-bold text-ink transition-all duration-300 hover:shadow-[0_0_44px_rgba(216,255,62,0.45)]"
          >
            Create free account
            <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
          </button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-ink/40">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline underline-offset-2 hover:text-ink">Terms</Link> and{" "}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-ink">Privacy Policy</Link>.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
