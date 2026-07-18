import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "@/components/auth-gate";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — RentReady AI" }] }),
  component: () => (
    <AuthGate>
      <OnboardingPage />
    </AuthGate>
  ),
});

const COUNTRIES = ["Germany", "USA", "United Kingdom", "Canada", "Other"];
const EMPLOYMENT = ["Student", "Employee", "Self-employed", "Freelancer", "Other"];
const DOCS = [
  "Passport",
  "Visa",
  "Employment Letter",
  "Payslip",
  "Bank Statement",
  "Utility Bill",
  "Rental Reference",
];

function OnboardingPage() {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [rentalCountry, setRentalCountry] = useState<string | null>(null);
  const [employment, setEmployment] = useState<string | null>(null);
  const [docs, setDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const steps = [
    {
      title: "Where are you renting?",
      subtitle: "We tailor recommendations to your rental market.",
      render: (
        <OptionGrid
          options={COUNTRIES}
          value={rentalCountry}
          onChange={setRentalCountry}
        />
      ),
      canContinue: !!rentalCountry,
    },
    {
      title: "What's your employment status?",
      subtitle: "Landlords review this closely.",
      render: (
        <OptionGrid options={EMPLOYMENT} value={employment} onChange={setEmployment} />
      ),
      canContinue: !!employment,
    },
    {
      title: "Which documents do you already have?",
      subtitle: "Select all that apply — you can add the rest later.",
      render: <MultiGrid options={DOCS} values={docs} onChange={setDocs} />,
      canContinue: true,
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const onNext = async () => {
    if (!current.canContinue) return;
    if (!isLast) return setStep((s) => s + 1);
    setBusy(true);
    const { error } = await updateProfile({
      rental_country: rentalCountry,
      employment_status: employment,
      onboarding_completed: true,
    });
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("You're all set");
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="relative min-h-dvh bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg gradient-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold tracking-tight">RentReady AI</div>
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of {steps.length}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-6 flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.4 }}
                className="h-full gradient-primary"
              />
            </div>
          ))}
        </div>

        <div className="mt-10 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {current.title}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{current.subtitle}</p>
              <div className="mt-6">{current.render}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            onClick={() => (step === 0 ? navigate({ to: "/welcome" }) : setStep((s) => s - 1))}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={onNext}
            disabled={!current.canContinue || busy}
            className="btn-primary-premium flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {isLast ? "Finish" : "Continue"} <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionGrid({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={
              "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition " +
              (active
                ? "border-primary bg-primary/[0.06] text-foreground shadow-glow"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/40")
            }
          >
            {o}
            {active && (
              <span className="grid h-5 w-5 place-items-center rounded-full gradient-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MultiGrid({
  options,
  values,
  onChange,
}: {
  options: string[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(values.includes(o) ? values.filter((v) => v !== o) : [...values, o]);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const active = values.includes(o);
        return (
          <button
            key={o}
            onClick={() => toggle(o)}
            className={
              "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition " +
              (active
                ? "border-primary bg-primary/[0.06] text-foreground"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/40")
            }
          >
            {o}
            <span
              className={
                "grid h-5 w-5 place-items-center rounded-md border " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border")
              }
            >
              {active && <Check className="h-3 w-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
