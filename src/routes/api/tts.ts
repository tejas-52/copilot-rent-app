import { createFileRoute } from "@tanstack/react-router";
import { verifyBearer } from "@/lib/copilot-auth.server";

const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah – multilingual, warm

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authed = await verifyBearer(request);
        if (!authed) return new Response("Unauthorized", { status: 401 });

        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });

        const { text } = (await request.json()) as { text?: string };
        if (!text?.trim()) return new Response("Text required", { status: 400 });

        // Trim to keep latency reasonable
        const cleaned = text.replace(/```[\s\S]*?```/g, "").slice(0, 2000);

        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: cleaned,
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3 },
            }),
          },
        );

        if (!res.ok) {
          const err = await res.text().catch(() => "");
          console.error("TTS failed", res.status, err);
          return new Response(`TTS failed: ${res.status} ${err}`, { status: res.status });
        }

        return new Response(res.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
