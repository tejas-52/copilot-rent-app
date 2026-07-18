import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Lock,
  Sparkles,
  Upload,
} from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { ConfidenceRing } from "@/components/confidence-ring";
import { FadeIn, SectionHeader, Stagger, StaggerItem } from "@/components/ui-bits";
import {
  confidence,
  documents,
  improvements,
  insights,
  journey,
  profile,
} from "@/lib/app-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RentReady AI — Your rental application copilot" },
      {
        name: "description",
        content:
          "RentReady AI prepares complete, verified rental applications so you apply with total confidence.",
      },
      { property: "og:title", content: "RentReady AI — Your rental application copilot" },
      {
        property: "og:description",
        content: "RentReady AI prepares complete, verified rental applications so you apply with total confidence.",
      },
    ],
  }),
  component: Dashboard,
});

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const recent = documents.filter((d) => d.status === "verified").slice(0, 3);
  const missing = documents.filter((d) => d.status !== "verified");

  return (
    <AppLayout>
      <Stagger className="space-y-6 pb-6">
        {/* Greeting */}
        <StaggerItem>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">
                {greet()}, {profile.firstName} 👋
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-[32px]">
                Let's get you rental ready.
              </h1>
            </div>
          </div>
        </StaggerItem>

        {/* Hero confidence card */}
        <StaggerItem>
          <div className="relative overflow-hidden rounded-[28px] border border-border/60 gradient-hero shadow-lg">
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(600px circle at 90% -10%, color-mix(in oklab, #3B82F6 20%, transparent), transparent 60%)",
              }}
            />
            <div className="relative grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10 md:p-10">
              <ConfidenceRing value={confidence} />
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> AI-verified
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-[26px]">
                  You're almost ready to apply.
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground md:text-base">
                  Only one verification left — complete residence proof to unlock
                  <span className="font-medium text-foreground"> Excellent</span> tier.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className="h-1.5 w-1.5 rounded-full bg-success"
                  />
                  Estimated completion · about 40 seconds
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    to="/documents"
                    className="group inline-flex items-center gap-2 rounded-full btn-primary-premium px-6 py-3.5 text-sm font-semibold"
                  >
                    Continue application
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    to="/report"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                  >
                    View report
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>


        {/* Journey */}
        <StaggerItem>
          <SectionHeader
            eyebrow="Journey"
            title="Your progress"
            subtitle="Five gentle steps to a complete application."
          />
          <div className="rounded-3xl border border-border/60 bg-card p-4 md:p-6">
            <ol className="grid gap-3 md:grid-cols-5">
              {journey.map((step, i) => {
                const state = step.done
                  ? "done"
                  : step.active
                    ? "active"
                    : step.locked
                      ? "locked"
                      : "idle";
                return (
                  <motion.li
                    key={step.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 md:flex-col md:items-start md:gap-2 md:p-4"
                  >
                    <div
                      className={
                        "grid h-9 w-9 place-items-center rounded-xl text-sm font-semibold " +
                        (state === "done"
                          ? "bg-success/15 text-success"
                          : state === "active"
                            ? "gradient-primary text-primary-foreground"
                            : state === "locked"
                              ? "bg-muted text-muted-foreground"
                              : "bg-accent text-accent-foreground")
                      }
                    >
                      {state === "done" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : state === "locked" ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{step.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {state === "done"
                          ? "Complete"
                          : state === "active"
                            ? "In progress"
                            : state === "locked"
                              ? "Locked"
                              : "Up next"}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        </StaggerItem>

        {/* Two column: insight + missing */}
        <div className="grid gap-4 md:grid-cols-2">
          <StaggerItem>
            <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Today's AI insight
              </div>
              <h3 className="text-lg font-semibold tracking-tight">
                {insights[0].title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{insights[0].body}</p>

              <div className="mt-5 space-y-2">
                {improvements.map((imp) => (
                  <div
                    key={imp.title}
                    className="flex items-center justify-between rounded-2xl bg-background/60 p-3"
                  >
                    <span className="text-sm">{imp.title}</span>
                    <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                      +{imp.impact}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">
                  Missing documents
                </h3>
                <Link
                  to="/documents"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  See all <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="space-y-2">
                {missing.slice(0, 4).map((d) => (
                  <Link
                    to="/documents"
                    key={d.id}
                    className="flex items-center gap-3 rounded-2xl bg-background/60 p-3 transition-colors hover:bg-accent"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <d.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.status === "issue"
                          ? d.issue
                          : d.status === "pending"
                            ? "Waiting for upload"
                            : "Not uploaded yet"}
                      </div>
                    </div>
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          </StaggerItem>
        </div>

        {/* Recent activity */}
        <StaggerItem>
          <FadeIn>
            <div className="rounded-3xl border border-border/60 bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">Recent uploads</h3>
                <Link
                  to="/documents"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  All documents <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ul className="divide-y divide-border/60">
                {recent.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <d.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        AI verified · {d.confidence}% confidence
                      </div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>
        </StaggerItem>
      </Stagger>
    </AppLayout>
  );
}
