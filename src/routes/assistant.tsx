import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Bot, Mic, Sparkles, Square, User, Volume2, VolumeX, X, AudioLines } from "lucide-react";
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
  const { isAuthenticated, isDemo } = useAuth();

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

  // Voice-only conversation mode (full overlay). Separate from the smaller
  // "auto-speak replies" toggle on the chat header.
  const [voiceConvo, setVoiceConvo] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { language, voiceMode: voiceConvo },
        headers: async () => await getBearerHeaders(),
      }),
    [language, voiceConvo],
  );

  const { messages, setMessages, sendMessage, status } = useChat({
    id: "assistant",
    messages: [welcomeMessage],
    transport,
  });

  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [revealed, setRevealed] = useState(""); // synced transcript for voice mode
  const [userTranscript, setUserTranscript] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastSpokenIdRef = useRef<string | null>(null);
  const historyLoadedRef = useRef(false);
  const voiceConvoRef = useRef(false);
  useEffect(() => {
    voiceConvoRef.current = voiceConvo;
  }, [voiceConvo]);

  const thinking = status === "submitted" || status === "streaming";

  // Load prior chat history (or seed a scripted conversation in demo mode)
  useEffect(() => {
    if (historyLoadedRef.current || !isAuthenticated) return;
    historyLoadedRef.current = true;
    (async () => {
      if (isDemo) {
        const { DEMO_CHAT } = await import("@/lib/demo-data");
        const history: UIMessage[] = DEMO_CHAT.map((m) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text", text: m.text }],
        }));
        setMessages([welcomeMessage, ...history]);
        return;
      }
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
  }, [isAuthenticated, isDemo, setMessages, welcomeMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const speak = useCallback(async (text: string, opts?: { sync?: boolean; onEnd?: () => void }) => {
    try {
      audioRef.current?.pause();
      setSpeaking(true);
      if (opts?.sync) setRevealed("");
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
      const cleanup = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        if (opts?.sync) setRevealed(text);
        opts?.onEnd?.();
      };
      audio.onended = cleanup;
      audio.onerror = () => cleanup();
      if (opts?.sync) {
        audio.ontimeupdate = () => {
          const d = audio.duration;
          if (!isFinite(d) || d <= 0) return;
          const ratio = Math.min(1, audio.currentTime / d);
          const n = Math.max(1, Math.floor(text.length * ratio));
          setRevealed(text.slice(0, n));
        };
      }
      await audio.play();
    } catch (err) {
      console.error(err);
      setSpeaking(false);
      opts?.onEnd?.();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }, []);

  // Simple auto-speak (non-voice-mode header toggle)
  useEffect(() => {
    if (!autoSpeak || voiceConvo || thinking) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.id === "welcome") return;
    if (lastSpokenIdRef.current === last.id) return;
    const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
    if (!text) return;
    lastSpokenIdRef.current = last.id;
    void speak(text);
  }, [messages, thinking, autoSpeak, voiceConvo, speak]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setInput("");
    if (voiceConvoRef.current) setUserTranscript(trimmed);
    void sendMessage({ text: trimmed });
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
      else toast.error(t("assistant.voice.notCaught", { defaultValue: "Didn't catch that — please try again." }));
    } catch (err) {
      console.error(err);
      toast.error("Voice transcription failed.");
    } finally {
      setTranscribing(false);
    }
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

  // Voice conversation loop: whenever a new assistant message arrives while
  // voiceConvo is on, speak it (with synced transcript reveal), then re-open
  // the mic for the next user turn.
  useEffect(() => {
    if (!voiceConvo || thinking) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.id === "welcome") return;
    if (lastSpokenIdRef.current === last.id) return;
    const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim();
    if (!text) return;
    lastSpokenIdRef.current = last.id;
    void speak(text, {
      sync: true,
      onEnd: () => {
        if (voiceConvoRef.current) {
          setUserTranscript("");
          // Small delay so the mic doesn't catch the tail of TTS
          setTimeout(() => {
            if (voiceConvoRef.current && !recording && !transcribing) void startRecording();
          }, 400);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, thinking, voiceConvo, speak]);

  const enterVoiceConvo = async () => {
    setVoiceConvo(true);
    setRevealed("");
    setUserTranscript("");
    // Kick off the first listen
    setTimeout(() => {
      if (!recording && !transcribing) void startRecording();
    }, 250);
  };

  const exitVoiceConvo = () => {
    setVoiceConvo(false);
    stopSpeaking();
    if (recording) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      setRecording(false);
    }
    setRevealed("");
    setUserTranscript("");
  };

  const orbState: "idle" | "listening" | "thinking" | "speaking" = speaking
    ? "speaking"
    : thinking || transcribing
      ? "thinking"
      : recording
        ? "listening"
        : "idle";

  const orbLabel = {
    idle: t("assistant.voice.tapToTalk", { defaultValue: "Tap the orb to talk" }),
    listening: t("assistant.voice.listening", { defaultValue: "Listening…" }),
    thinking: t("assistant.voice.thinking", { defaultValue: "Thinking…" }),
    speaking: t("assistant.voice.speaking", { defaultValue: "Speaking…" }),
  }[orbState];

  return (
    <AppLayout>
      <SectionHeader
        eyebrow={t("nav.assistant")}
        title={t("assistant.title")}
        subtitle={t("assistant.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="relative flex h-[62dvh] min-h-[520px] flex-col overflow-hidden rounded-3xl border border-border/60 bg-card md:h-[68dvh]">
          <div className="flex items-center justify-between border-b border-border/60 bg-background/40 px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {speaking ? "Speaking…" : recording ? "Listening…" : transcribing ? "Transcribing…" : "Grounded in your application"}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoSpeak((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  autoSpeak
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Auto-speak replies"
              >
                {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                Auto-speak
              </button>
              <button
                onClick={enterVoiceConvo}
                className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                aria-label="Enter voice mode"
              >
                <AudioLines className="h-3.5 w-3.5" />
                {t("assistant.voice.enter", { defaultValue: "Voice mode" })}
              </button>
            </div>
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

          {/* Voice-conversation overlay */}
          <AnimatePresence>
            {voiceConvo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-gradient-to-b from-background/95 via-background/98 to-background backdrop-blur-xl"
              >
                <div className="flex items-center justify-between px-5 pt-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t("assistant.voice.title", { defaultValue: "Voice conversation" })}
                  </div>
                  <button
                    onClick={exitVoiceConvo}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
                    aria-label="Close voice mode"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
                  <VoiceOrb
                    state={orbState}
                    onTap={() => {
                      if (recording) stopRecording();
                      else if (speaking) stopSpeaking();
                      else if (!thinking && !transcribing) void startRecording();
                    }}
                  />

                  <div className="text-sm font-medium text-muted-foreground">{orbLabel}</div>

                  <div className="min-h-[96px] w-full max-w-xl text-center">
                    <AnimatePresence mode="wait">
                      {userTranscript && (
                        <motion.div
                          key="u"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 0.7, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="mb-3 text-xs uppercase tracking-widest text-muted-foreground"
                        >
                          {t("assistant.voice.you", { defaultValue: "You" })} · “{userTranscript}”
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <motion.div
                      key={revealed ? "r" : "empty"}
                      className="whitespace-pre-wrap text-lg leading-relaxed text-foreground"
                    >
                      {revealed}
                      {speaking && revealed && (
                        <motion.span
                          animate={{ opacity: [0.2, 1, 0.2] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-primary"
                        />
                      )}
                    </motion.div>
                  </div>
                </div>

                <div className="pb-6 text-center text-xs text-muted-foreground">
                  {t("assistant.voice.hint", {
                    defaultValue: "Tap the orb to pause. Replies are kept brief on purpose.",
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

function VoiceOrb({
  state,
  onTap,
}: {
  state: "idle" | "listening" | "thinking" | "speaking";
  onTap: () => void;
}) {
  const rings = state === "speaking" ? [0, 1, 2] : state === "listening" ? [0, 1] : [];
  return (
    <button
      type="button"
      onClick={onTap}
      className="relative grid h-56 w-56 place-items-center rounded-full outline-none"
      aria-label="Voice orb"
    >
      {/* expanding rings */}
      {rings.map((i) => (
        <motion.span
          key={i}
          initial={{ scale: 0.9, opacity: 0.5 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 1.8, delay: i * 0.5, repeat: Infinity, ease: "easeOut" }}
          className={`absolute inset-0 rounded-full ${
            state === "speaking" ? "bg-primary/25" : "bg-destructive/25"
          }`}
        />
      ))}

      {/* core orb */}
      <motion.div
        animate={
          state === "idle"
            ? { scale: [1, 1.04, 1] }
            : state === "listening"
              ? { scale: [1, 1.08, 1] }
              : state === "thinking"
                ? { rotate: 360 }
                : { scale: [1, 1.06, 1] }
        }
        transition={
          state === "thinking"
            ? { duration: 2.4, repeat: Infinity, ease: "linear" }
            : { duration: state === "idle" ? 3.6 : 1.4, repeat: Infinity, ease: "easeInOut" }
        }
        className="relative grid h-40 w-40 place-items-center rounded-full shadow-2xl"
        style={{
          background:
            "conic-gradient(from 140deg, hsl(var(--primary)/0.9), hsl(var(--primary)/0.35), hsl(var(--primary)/0.85))",
        }}
      >
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/25 to-transparent" />
        <div className="absolute inset-4 rounded-full bg-background/30 backdrop-blur-md" />
        {/* waveform */}
        <div className="relative flex items-end gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              animate={
                state === "speaking"
                  ? { height: [6, 22, 10, 26, 8] }
                  : state === "listening"
                    ? { height: [4, 14, 6, 18, 8] }
                    : { height: 6 }
              }
              transition={{
                duration: 0.9,
                repeat: state === "idle" || state === "thinking" ? 0 : Infinity,
                delay: i * 0.08,
                ease: "easeInOut",
              }}
              className="w-1 rounded-full bg-primary-foreground/90"
              style={{ height: 6 }}
            />
          ))}
        </div>
      </motion.div>
    </button>
  );
}
