import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "@/components/auth-gate";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Welcome — RentReady AI" }] }),
  component: () => (
    <AuthGate>
      <WelcomePage />
    </AuthGate>
  ),
});

function WelcomePage() {
  const navigate = useNavigate();
  const { firstName, profile, isDemo } = useAuth();

  // Demo users skip straight through
  useEffect(() => {
    if (isDemo) navigate({ to: "/", replace: true });
  }, [isDemo, navigate]);

  const next = profile?.onboarding_completed ? "/" : "/onboarding";

  return (
    <div className="relative min-h-dvh bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="mx-auto flex min-h-dvh w-full max-w-lg items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full text-center"
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">
            Welcome{firstName && firstName !== "there" ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Let's prepare your rental application. We'll walk you through everything.
          </p>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            Estimated time · <span className="font-semibold">5 minutes</span>
          </div>

          <button
            onClick={() => navigate({ to: next })}
            className="btn-primary-premium mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold sm:w-auto sm:min-w-[240px]"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
