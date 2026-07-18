import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider, CHAT_MODEL } from "@/lib/ai-gateway.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, context } = (await request.json()) as {
          messages?: UIMessage[];
          context?: unknown;
        };
        if (!Array.isArray(messages)) {
          return new Response("Messages required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const system = `You are RentReady AI, a warm, precise copilot for renters. You are grounded in the user's rental application context. Be concise, encouraging, and specific.${
          context ? `\n\nApplication context:\n${JSON.stringify(context)}` : ""
        }`;

        const result = streamText({
          model: gateway(CHAT_MODEL),
          system,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
