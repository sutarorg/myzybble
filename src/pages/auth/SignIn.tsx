import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Check, Mail } from "lucide-react";
import AuthShell, { Field, inputCls } from "../../components/AuthShell";
import { EASE } from "../../components/ui";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [errs, setErrs] = useState<{ email?: string; pw?: string }>({});
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errs = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "valid email required";
    if (pw.length < 6) next.pw = "min 6 characters";
    setErrs(next);
    if (Object.keys(next).length === 0) setSent(true);
  };

  return (
    <AuthShell
      title="Sign in — zybble"
      meta="Sign in to zybble to keep generating verified Google Maps leads."
      heading="Welcome back"
      sub="Your pipeline missed you. Pick up right where you left off."
      foot={
        <p className="text-center text-sm text-ink/55">
          New to zybble?{" "}
          <Link to="/signup" className="font-semibold text-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-4">
            Create a free account
          </Link>
        </p>
      }
    >
      {sent ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="rounded-2xl border border-ink/10 bg-white/70 p-8 text-center"
        >
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-lime">
            <Check className="h-7 w-7 text-ink" strokeWidth={3} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">Signed in — welcome back</h2>
          <p className="mt-2 text-sm text-ink/55">
            This is a demo flow. Your dashboard would open right here.
          </p>
          <Link
            to="/"
            className="group mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper"
          >
            Explore the site
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="space-y-5">
            <Field label="Work email" error={errs.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink/35" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={`${inputCls} pl-11`}
                  autoComplete="email"
                />
              </div>
            </Field>
            <Field label="Password" error={errs.pw}>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} pr-12`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/40 transition-colors hover:text-ink"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </Field>
          </div>

          <div className="mt-5 flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2.5 text-ink/60">
              <input type="checkbox" defaultChecked className="peer sr-only" />
              <span className="grid h-5 w-5 place-items-center rounded-md border border-ink/20 bg-white transition-colors peer-checked:border-ink peer-checked:bg-ink [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
                <Check className="h-3 w-3 text-lime transition-opacity" strokeWidth={3.5} />
              </span>
              Remember me
            </label>
            <a href="#" className="font-medium text-ink underline decoration-lime decoration-2 underline-offset-4">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="group mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 font-semibold text-paper transition-all duration-300 hover:bg-ink-3 hover:shadow-[0_16px_44px_rgba(11,16,14,0.28)]"
          >
            Sign in
            <ArrowRight className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
          </button>
          <p className="mt-5 text-center font-mono text-[11px] text-ink/40">
            protected by SOC 2-grade encryption · sso available
          </p>
        </form>
      )}
    </AuthShell>
  );
}
