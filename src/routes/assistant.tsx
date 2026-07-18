import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Bot, Sparkles, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useTranslation } from "react-i18next";
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

function AssistantPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language?.split("-")[0] ?? "en";

  const suggestions = [
    t("assistant.suggestions.why"),
    t("assistant.suggestions.score"),
    t("assistant.suggestions.missing"),
    t("assistant.suggestions.improve"),
  ];

  const initialMessages: UIMessage[] = useMemo(
    () => [
      {
        id: "welcome",
        role: "assistant",
        parts: [{ type: "text", text: t("assistant.welcome") }],
      },
    ],
    [t],
  );

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { language } }),
    [language],
  );
  const { messages, sendMessage, status } = useChat({
    id: "assistant",
    messages: initialMessages,
    transport,
  });
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const thinking = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function send(text: string) {
    const t = text.trim();
    if (!t || thinking) return;
    setInput("");
    void sendMessage({ text: t });
  }

  return (
    <AppLayout>
      <SectionHeader
        eyebrow={t("nav.assistant")}
        title={t("assistant.title")}
        subtitle={t("assistant.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="flex h-[62dvh] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card md:h-[68dvh]">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const text = m.parts
                  .map((p) => (p.type === "text" ? p.text : ""))
                  .join("");
                if (!text) return null;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : ""}`}
                  >
                    {m.role !== "user" && (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full gradient-primary text-primary-foreground">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={
                        "max-w-[78%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-sm leading-relaxed " +
                        (m.role === "user"
                          ? "gradient-primary text-primary-foreground shadow-glow"
                          : "bg-background text-foreground")
                      }
                    >
                      {text}
                    </div>
                    {m.role === "user" && (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
              {thinking && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2">
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
                placeholder={t("assistant.placeholder")}
                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={!input.trim() || thinking}
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
            <Bot className="h-3.5 w-3.5" /> {t("assistant.tryAsking")}
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
