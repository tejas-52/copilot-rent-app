import { createFileRoute } from "@tanstack/react-router";
import { verifyBearer } from "@/lib/copilot-auth.server";

// ElevenLabs Scribe language codes (ISO-639-3)
const LANG_ISO: Record<string, string> = { en: "eng", de: "deu", hi: "hin" };

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authed = await verifyBearer(request);
        if (!authed) return new Response("Unauthorized", { status: 401 });

        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });

        const inbound = await request.formData();
        const file = inbound.get("audio") as File | null;
        const language = String(inbound.get("language") ?? "en");
        if (!file) return new Response("Audio required", { status: 400 });

        const out = new FormData();
        out.append("file", file, file.name || "recording.webm");
        out.append("model_id", "scribe_v1");
        const iso = LANG_ISO[language];
        if (iso) out.append("language_code", iso);

        const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": key },
          body: out,
        });

        if (!res.ok) {
          const err = await res.text().catch(() => "");
          console.error("STT failed", res.status, err);
          return new Response(`STT failed: ${res.status} ${err}`, { status: res.status });
        }
        const data = (await res.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
