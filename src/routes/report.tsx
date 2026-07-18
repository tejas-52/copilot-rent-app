import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { ConfidenceRing } from "@/components/confidence-ring";
import { ConfidenceRadar } from "@/components/confidence-radar";
import { SectionHeader, Stagger, StaggerItem } from "@/components/ui-bits";
import {
  confidence,
  documents,
  improvements,
  profile,
  timeline,
} from "@/lib/app-data";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Rental Report — RentReady AI" },
      {
        name: "description",
        content: "A beautifully formatted rental application report, powered by AI.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const verified = documents.filter((d) => d.status === "verified");
  const missing = documents.filter((d) => d.status !== "verified");
  const [landlord, setLandlord] = useState(false);

  return (
    <AppLayout>
      <SectionHeader
        eyebrow="Report"
        title={landlord ? "Landlord preview" : "Your rental application report"}
        subtitle={
          landlord
            ? "This is exactly what your landlord sees when you share this application."
            : "A single, landlord-ready summary — reviewed by AI."
        }
        action={
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setLandlord((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-5 py-3 text-sm font-semibold transition-colors hover:bg-accent"
            >
              <Eye className="h-4 w-4" />
              {landlord ? "Applicant view" : "Landlord preview"}
            </button>
            <button className="inline-flex items-center gap-2 rounded-full gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
              <Download className="h-4 w-4" /> Export PDF
            </button>
          </div>
        }
      />

      <AnimatePresence>
        {landlord && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.05] px-4 py-3 text-sm"
          >
            <span className="font-medium text-primary">
              Read-only preview · shared securely with landlord
            </span>
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
              Ready to review
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <Stagger className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <StaggerItem>
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-center py-2">
              <ConfidenceRing value={confidence} size={200} />
            </div>
            <div className="mt-4 rounded-2xl bg-background/60 p-4 text-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> AI Summary
              </div>
              <p className="mt-2 text-muted-foreground">
                {profile.name} presents a strong rental profile: verified identity,
                stable employment at {profile.employment}, and monthly income of{" "}
                {profile.monthlyIncome}. Two minor items remain before submission.
              </p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
            <h3 className="text-lg font-semibold tracking-tight">Application timeline</h3>
            <ol className="relative mt-5 space-y-4 pl-6">
              <span className="absolute left-[10px] top-2 bottom-2 w-px bg-border" />
              {timeline.map((t, i) => (
                <motion.li
                  key={t.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="relative"
                >
                  <span
                    className={
                      "absolute -left-6 top-0.5 grid h-5 w-5 place-items-center rounded-full " +
                      (t.done
                        ? "bg-success text-success-foreground"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {t.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.date}</div>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </StaggerItem>

        <StaggerItem className="md:col-span-2">
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <h3 className="text-lg font-semibold tracking-tight">Application summary</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Applicant", profile.name],
                ["Occupation", profile.occupation],
                ["Monthly Income", profile.monthlyIncome],
                ["Visa Status", profile.visa],
                ["Current Address", profile.address],
                ["Nationality", profile.nationality],
                ["Employment", profile.employment],
                ["Confidence", `${confidence}% · Excellent`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-background/60 p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
            <h3 className="text-lg font-semibold tracking-tight">Verified documents</h3>
            <ul className="mt-4 space-y-2">
              {verified.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-2xl bg-background/60 p-3"
                >
                  <BadgeCheck className="h-5 w-5 text-success" />
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">
                    {d.name}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {d.confidence}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
            <h3 className="text-lg font-semibold tracking-tight">Recommendations</h3>
            <ul className="mt-4 space-y-2">
              {missing.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-2xl bg-background/60 p-3"
                >
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">
                    Add {d.name.toLowerCase()}
                  </div>
                </li>
              ))}
              {improvements.map((i) => (
                <li
                  key={i.title}
                  className="flex items-center gap-3 rounded-2xl bg-background/60 p-3"
                >
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">
                    {i.title}
                  </div>
                  <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                    +{i.impact}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </StaggerItem>

        <StaggerItem className="md:col-span-2 md:hidden">
          <button className="w-full inline-flex items-center justify-center gap-2 rounded-full gradient-primary px-5 py-4 text-sm font-semibold text-primary-foreground shadow-glow">
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </StaggerItem>
      </Stagger>
    </AppLayout>
  );
}
