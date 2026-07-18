import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Bot, Mic, Sparkles, Square, User, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { SectionHeader } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

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

async function getBearerHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function AssistantPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language?.split("-")[0] ?? "en";
  const { isAuthenticated } = useAuth();

  const suggestions = [
    t("assistant.suggestions.why"),
    t("assistant.suggestions.score"),
    t("assistant.suggestions.missing"),
    t("assistant.suggestions.improve"),
  ];

  const welcomeMessage: UIMessage = useMemo(
    () => ({
      id: "welcome",
      role: "assistant",
      parts: [{ type: "text", text: t("assistant.welcome") }],
    }),
    [t],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { language },
        headers: async () => await getBearerHeaders(),
      }),
    [language],
  );

  const { messages, setMessages, sendMessage, status } = useChat({
    id: "assistant",
    messages: [welcomeMessage],
    transport,
  });

  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastSpokenIdRef = useRef<string | null>(null);
  const historyLoadedRef = useRef(false);

  const thinking = status === "submitted" || status === "streaming";

  // Load prior chat history from Supabase (once, if authenticated)
  useEffect(() => {
    if (historyLoadedRef.current || !isAuthenticated) return;
    historyLoadedRef.current = true;
    (async () => {
      const { data: app } = await supabase
        .from("applications")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!app) return;
      const { data: rows } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("application_id", app.id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (!rows?.length) return;
      const history: UIMessage[] = rows.map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant",
        parts: [{ type: "text", text: r.content }],
      }));
      setMessages([welcomeMessage, ...history]);
    })();
  }, [isAuthenticated, setMessages, welcomeMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Speak the latest assistant message when voice mode is on
  useEffect(() => {
    if (!voiceMode || thinking) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.id === "welcome") return;
    if (lastSpokenIdRef.current === last.id) return;
    const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
    if (!text) return;
    lastSpokenIdRef.current = last.id;
    void speak(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, thinking, voiceMode]);

  const speak = useCallback(async (text: string) => {
    try {
      audioRef.current?.pause();
      setSpeaking(true);
      const headers = await getBearerHeaders();
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch (err) {
      console.error(err);
      setSpeaking(false);
    }
  }, []);

  const stopSpeaking = () => {
    audioRef.current?.pause();
    setSpeaking(false);
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setInput("");
    void sendMessage({ text: trimmed });
  };

  const startRecording = async () => {
    if (recording || transcribing) return;
    try {
      stopSpeaking();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 1500) {
          toast.error("Recording was too short. Try again.");
          return;
        }
        await transcribe(blob);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      if (!voiceMode) setVoiceMode(true);
    } catch (err) {
      console.error(err);
      toast.error("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribe = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `recording.${ext}`);
      fd.append("language", language);
      const headers = await getBearerHeaders();
      const res = await fetch("/api/stt", { method: "POST", headers, body: fd });
      if (!res.ok) throw new Error(`STT ${res.status}`);
      const { text } = (await res.json()) as { text?: string };
      if (text?.trim()) send(text);
      else toast.error("Didn't catch that — please try again.");
    } catch (err) {
      console.error(err);
      toast.error("Voice transcription failed.");
    } finally {
      setTranscribing(false);
    }
  };

  const toggleVoiceMode = () => {
    if (voiceMode) stopSpeaking();
    setVoiceMode((v) => !v);
  };

  return (
    <AppLayout>
      <SectionHeader
        eyebrow={t("nav.assistant")}
        title={t("assistant.title")}
        subtitle={t("assistant.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="flex h-[62dvh] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card md:h-[68dvh]">
          <div className="flex items-center justify-between border-b border-border/60 bg-background/40 px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {speaking ? "Speaking…" : recording ? "Listening…" : transcribing ? "Transcribing…" : "Grounded in your application"}
            </div>
            <button
              onClick={toggleVoiceMode}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                voiceMode
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Toggle voice mode"
            >
              {voiceMode ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              Voice
            </button>
          </div>

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
                        "group relative max-w-[78%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-sm leading-relaxed " +
                        (m.role === "user"
                          ? "gradient-primary text-primary-foreground shadow-glow"
                          : "bg-background text-foreground")
                      }
                    >
                      {text}
                      {m.role === "assistant" && m.id !== "welcome" && (
                        <button
                          onClick={() => (speaking ? stopSpeaking() : speak(text))}
                          className="absolute -bottom-2 -right-2 grid h-7 w-7 place-items-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-primary group-hover:opacity-100"
                          aria-label="Play"
                        >
                          {speaking ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                        </button>
                      )}
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
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing || thinking}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all disabled:opacity-40 ${
                  recording
                    ? "bg-destructive text-destructive-foreground shadow-glow animate-pulse"
                    : "bg-accent text-accent-foreground hover:bg-accent/70"
                }`}
                aria-label={recording ? "Stop recording" : "Start recording"}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
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
                placeholder={
                  recording
                    ? "Listening…"
                    : transcribing
                      ? "Transcribing…"
                      : t("assistant.placeholder")
                }
                disabled={recording || transcribing}
                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
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
