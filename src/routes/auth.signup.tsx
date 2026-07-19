import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — RentReady AI" },
      { name: "description", content: "Sign up for RentReady AI in seconds." },
    ],
  }),
  component: SignupPage,
});

const COUNTRIES = ["United Kingdom", "Germany", "United States", "Canada", "India", "Other"];

function passwordStrength(pw: string): { score: number; label: string; color: string; percent: number } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;
  const map: Record<number, { label: string; color: string; percent: number }> = {
    0: { label: "Very weak", color: "#EF4444", percent: 25 },
    1: { label: "Weak", color: "#EF4444", percent: 25 },
    2: { label: "Fair", color: "#F59E0B", percent: 50 },
    3: { label: "Good", color: "#22C55E", percent: 75 },
    4: { label: "Strong", color: "#22C55E", percent: 100 },
  };
  return { score: Math.min(score, 4), ...map[Math.min(score, 4)] };
}

function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signUp, signInWithGoogle, enableDemo } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState("United Kingdom");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [busy, setBusy] = useState<null | "email" | "google" | "demo">(null);

  const strength = useMemo(() => passwordStrength(password), [password]);

  const features = [
    { icon: FileCheck2, label: t("auth.features.aiReview") },
    { icon: ShieldCheck, label: "Verified rental profile" },
    { icon: Bot, label: t("auth.features.assistant") },
    { icon: Sparkles, label: "AI-powered document prep" },
  ];

  const onEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error(t("auth.errors.passwordShort"));
    if (!agreeTerms) return toast.error("Please agree to the Terms of Service and Privacy Policy.");
    setBusy("email");
    const { error } = await signUp(name, email, password, country);
    setBusy(null);
    if (error) return toast.error(error);
    toast.success(t("auth.toasts.created"));
    navigate({ to: "/welcome", replace: true });
  };

  const onGoogle = async () => {
    setBusy("google");
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("auth.errors.googleFailed"));
      setBusy(null);
    }
  };

  const onDemo = () => {
    setBusy("demo");
    enableDemo();
    toast.success(t("auth.toasts.demo"));
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="relative min-h-dvh bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* ---------- Split layout ---------- */}
      <div className="mx-auto grid min-h-dvh w-full max-w-[1400px] grid-cols-1 lg:grid-cols-2">
        {/* Hero (left) */}
        <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 gradient-hero">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold tracking-tight">{t("app.name")}</div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="max-w-md"
          >
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              {t("auth.createAccount")}{" "}
              <span className="text-gradient">in 30 seconds</span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Join thousands of renters who prepare stronger applications with RentReady AI.
            </p>
            <ul className="mt-8 space-y-3">
              {features.map((f) => (
                <li key={f.label} className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{f.label}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {t("app.name")}
          </div>
        </div>

        {/* Form (right) */}
        <div className="flex items-center justify-center p-6 md:p-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm"
          >
            {/* Mobile logo */}
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold tracking-tight">{t("app.name")}</div>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight">{t("auth.createAccount")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.createSubtitle")}</p>

            {/* Email form */}
            <form onSubmit={onEmailSubmit} className="mt-6 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("common.name")}</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Alex Doe"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("common.email")}</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("common.password")}</label>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password strength bar */}
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: strength.color }}
                        initial={{ width: "0%" }}
                        animate={{ width: `${strength.percent}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">{t("common.country")}</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Terms checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  I agree to the{" "}
                  <span className="font-medium text-foreground underline underline-offset-2">Terms of Service</span>
                  {" "}and{" "}
                  <span className="font-medium text-foreground underline underline-offset-2">Privacy Policy</span>
                </span>
              </label>

              <button
                type="submit"
                disabled={busy !== null}
                className="btn-primary-premium mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-70"
              >
                {busy === "email" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {t("auth.createAccount")} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              {t("common.or")}
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Google sign-up */}
            <button
              onClick={onGoogle}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-accent/50 disabled:opacity-70"
            >
              {busy === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <GoogleIcon /> {t("auth.continueWithGoogle")}
                </>
              )}
            </button>

            {/* Demo */}
            <button
              onClick={onDemo}
              disabled={busy !== null}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/[0.04] px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/[0.08] disabled:opacity-70"
            >
              <Sparkles className="h-4 w-4" /> {t("auth.continueAsDemo")}
            </button>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link to="/auth" className="font-semibold text-primary hover:underline">
                {t("common.signIn")}
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.95l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
