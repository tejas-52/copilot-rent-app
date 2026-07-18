import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { SectionHeader, Stagger, StaggerItem } from "@/components/ui-bits";
import { documents, type DocStatus, type DocumentItem } from "@/lib/app-data";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — RentReady AI" },
      {
        name: "description",
        content: "Upload rental documents and let AI verify them instantly.",
      },
    ],
  }),
  component: DocumentsPage,
});

const statusMeta: Record<
  DocStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  verified: {
    label: "Verified",
    className: "bg-success/15 text-success",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  issue: {
    label: "Needs attention",
    className: "bg-warning/15 text-warning-foreground",
    icon: AlertTriangle,
  },
  missing: { label: "Not uploaded", className: "bg-accent text-accent-foreground", icon: Circle },
};

function DocCard({ doc, onOpen }: { doc: DocumentItem; onOpen: (d: DocumentItem) => void }) {
  const s = statusMeta[doc.status];
  const Icon = doc.icon;
  const SIcon = s.icon;
  const shell =
    doc.status === "missing"
      ? "border-2 border-dashed border-primary/40 bg-card/60 hover:border-primary/70"
      : doc.status === "issue"
        ? "border border-warning/50 bg-card hover:border-warning"
        : "border border-border/60 bg-card";
  return (
    <button
      onClick={() => onOpen(doc)}
      className={`group card-lift card-lift-hover relative flex h-full min-h-[168px] w-full flex-col rounded-3xl p-5 text-left shadow-sm ${shell}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl transition-transform group-hover:scale-105 ${
            doc.status === "missing"
              ? "gradient-primary text-primary-foreground shadow-glow"
              : "bg-accent text-accent-foreground"
          }`}
        >
          {doc.status === "missing" ? <Upload className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.className} ${
            doc.status === "pending" ? "animate-pulse" : ""
          }`}
        >
          <SIcon className="h-3 w-3" /> {s.label}
        </span>
      </div>
      <div className="mt-auto pt-5">
        <div className="text-base font-semibold tracking-tight">{doc.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {doc.status === "verified" && `${doc.confidence}% confidence`}
          {doc.status === "pending" && "Analyzing…"}
          {doc.status === "issue" && doc.issue}
          {doc.status === "missing" && "Tap to upload"}
        </div>
      </div>
    </button>
  );
}


const readingSteps = [
  "Reading document…",
  "Extracting information…",
  "Checking authenticity…",
  "Cross-referencing profile…",
  "Identity verified",
];

function UploadModal({ doc, onClose }: { doc: DocumentItem; onClose: () => void }) {
  const [phase, setPhase] = useState<"drop" | "reading" | "done">(
    doc.status === "missing" || doc.status === "pending" ? "drop" : "done",
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (phase !== "reading") return;
    if (step >= readingSteps.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [phase, step]);

  useEffect(() => {
    if (phase === "reading" && step === readingSteps.length - 1) {
      const t = setTimeout(() => setPhase("done"), 700);
      return () => clearTimeout(t);
    }
  }, [phase, step]);

  const Icon = doc.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm md:items-center md:p-6">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-card shadow-lg md:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">{doc.name}</div>
              <div className="text-xs text-muted-foreground">
                {phase === "done" ? "Verified by AI" : "Upload securely"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {phase === "drop" && (
              <motion.div
                key="drop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  onClick={() => {
                    setPhase("reading");
                    setStep(0);
                  }}
                  className="relative flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-background/60 p-10 text-center transition-colors hover:border-primary/60 hover:bg-accent/40"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow"
                  >
                    <Upload className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <div className="text-base font-semibold">Drop your file here</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      PDF, PNG, JPG · up to 10 MB
                    </div>
                  </div>
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setPhase("reading");
                      setStep(0);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-accent"
                  >
                    <Camera className="h-4 w-4" /> Use camera
                  </button>
                  <button
                    onClick={() => {
                      setPhase("reading");
                      setStep(0);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
                  >
                    Choose file
                  </button>
                </div>
              </motion.div>
            )}

            {phase === "reading" && (
              <motion.div
                key="reading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6"
              >
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl gradient-primary text-primary-foreground shadow-glow">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="h-8 w-8" />
                  </motion.div>
                </div>
                <div className="mt-6 space-y-2">
                  {readingSteps.map((s, i) => (
                    <div
                      key={s}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                        i < step
                          ? "text-muted-foreground"
                          : i === step
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground/60"
                      }`}
                    >
                      {i < step ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : i === step ? (
                        <motion.div
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="h-2 w-2 rounded-full bg-primary"
                        />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {phase === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div className="text-sm font-semibold">Verified with AI</div>
                  {doc.confidence && (
                    <span className="ml-auto rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                      {doc.confidence}% confidence
                    </span>
                  )}
                </div>
                {doc.extracted ? (
                  <dl className="grid grid-cols-2 gap-3">
                    {doc.extracted.map((e) => (
                      <div
                        key={e.label}
                        className="rounded-2xl bg-background/60 p-3"
                      >
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {e.label}
                        </dt>
                        <dd className="mt-1 text-sm font-semibold">{e.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Upload a file to see extracted details here.
                  </p>
                )}
                {doc.status === "issue" && (
                  <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground" />
                      <div>
                        <div className="text-sm font-semibold">
                          Suggested improvement
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {doc.issue} Uploading a more recent version raises confidence
                          by up to 5%.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-accent">
                    Preview
                  </button>
                  <button
                    onClick={() => {
                      setPhase("drop");
                      setStep(0);
                    }}
                    className="rounded-2xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
                  >
                    Replace
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function DocumentsPage() {
  const [open, setOpen] = useState<DocumentItem | null>(null);
  const verified = documents.filter((d) => d.status === "verified").length;

  return (
    <AppLayout>
      <SectionHeader
        eyebrow="Documents"
        title="Everything in one secure place"
        subtitle={`${verified} of ${documents.length} verified · AI checks each document as you upload.`}
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((d) => (
          <StaggerItem key={d.id}>
            <DocCard doc={d} onOpen={setOpen} />
          </StaggerItem>
        ))}
      </Stagger>

      <AnimatePresence>
        {open && <UploadModal doc={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </AppLayout>
  );
}
