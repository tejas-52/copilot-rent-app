import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Bot, Sparkles, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { SectionHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "Assistant — RentReady AI" },
      {
        name: "description",
        content: "Ask the RentReady copilot anything about your rental application.",
      },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "ai"; text: string };

const suggestions = [
  "Why isn't my application ready?",
  "Explain my rental confidence score.",
  "What documents am I missing?",
  "How can I improve my score?",
];

const canned: Record<string, string> = {
  "Why isn't my application ready?":
    "You're at 94% confidence. Two things stand between you and 'Excellent': a recent bank statement (last 60 days) and a rental reference from your previous landlord. Add both and you'll be application-ready.",
  "Explain my rental confidence score.":
    "Rental Confidence blends four signals — identity, income, employment, and residence. Yours is strong on identity and employment (both 98%+). Residence is still pending, which is why we're at 94% instead of 100%.",
  "What documents am I missing?":
    "You're missing a recent bank statement, a valid tax document, and a rental reference. Your payslip is uploaded but older than 60 days — I'd replace it with the September one.",
  "How can I improve my score?":
    "Upload your latest bank statement (+5%), replace the outdated payslip (+4%), and add a rental reference letter (+3%). That takes you to 98% — the tier landlords trust most.",
};

function reply(q: string): string {
  return (
    canned[q] ??
    "Great question. I've reviewed your uploaded documents and profile — here's what stands out: your identity and employment are fully verified, and your income is well above the typical requirement. Focus next on residence proof to unlock the highest tier."
  );
}

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text: "Hi John — I'm your RentReady copilot. Ask me anything about your application, or tap a suggestion below.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: "ai", text: reply(text) }]);
      setThinking(false);
    }, 900);
  }

  return (
    <AppLayout>
      <SectionHeader
        eyebrow="Copilot"
        title="Ask your AI assistant"
        subtitle="Grounded in your uploaded documents. Always warm, never robotic."
      />

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="flex h-[62dvh] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card md:h-[68dvh]">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : ""}`}
                >
                  {m.role === "ai" && (
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full gradient-primary text-primary-foreground">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={
                      "max-w-[78%] rounded-3xl px-4 py-2.5 text-sm leading-relaxed " +
                      (m.role === "user"
                        ? "gradient-primary text-primary-foreground shadow-glow"
                        : "bg-background text-foreground")
                    }
                  >
                    {m.text}
                  </div>
                  {m.role === "user" && (
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </motion.div>
              ))}
              {thinking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-end gap-2"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full gradient-primary text-primary-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="flex gap-1 rounded-3xl bg-background px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border/60 bg-background/60 p-3"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask about your application…"
                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow disabled:opacity-40"
                aria-label="Send"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-2 rounded-3xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Bot className="h-3.5 w-3.5" /> Try asking
          </div>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="w-full rounded-2xl bg-background/70 p-3 text-left text-sm font-medium transition-colors hover:bg-accent"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
