import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, CHAT_MODEL } from "@/lib/ai-gateway.server";
import { verifyBearer } from "@/lib/copilot-auth.server";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  de: "German (Deutsch)",
  hi: "Hindi (हिन्दी)",
};

async function loadContext(supabase: any, userId: string) {
  const { data: app } = await supabase
    .from("applications")
    .select("id, status, confidence_score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app) return { app: null, docs: [], extractions: [], validation: null, recommendations: null, history: [] };

  const appId = app.id;
  const [{ data: docs }, { data: extractions }, { data: validation }, { data: recommendations }, { data: history }] =
    await Promise.all([
      supabase
        .from("documents")
        .select("file_name, doc_type, status, confidence, error")
        .eq("application_id", appId),
      supabase
        .from("extractions")
        .select("data, confidence, document_id")
        .eq("user_id", userId),
      supabase
        .from("validations")
        .select("checks, issues")
        .eq("application_id", appId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("recommendations")
        .select("items")
        .eq("application_id", appId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("application_id", appId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return {
    app,
    docs: docs ?? [],
    extractions: extractions ?? [],
    validation,
    recommendations,
    history: (history ?? []).reverse(),
  };
}

async function loadProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, rental_country, employment_status, preferred_language")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

function buildSystemPrompt(lang: string, profile: any, ctx: any, voiceMode: boolean) {
  const langName = LANG_NAMES[lang] ?? "English";
  const summary = {
    profile,
    application: ctx.app,
    documents: ctx.docs,
    extracted_fields: ctx.extractions.map((e: any) => e.data),
    validation_issues: ctx.validation?.issues ?? [],
    validation_checks: ctx.validation?.checks ?? [],
    recommendations: ctx.recommendations?.items ?? [],
  };
  const voiceRule = voiceMode
    ? `\n\nVOICE MODE — CRITICAL: The user is talking to you hands-free. Reply with ONLY the single most important point. Maximum 2 short spoken sentences (~35 words). No lists, no markdown, no headings, no code, no URLs — plain conversational speech only. If more detail is needed, end with a short question like "Want the details?" instead of giving them.`
    : "";
  return `You are RentReady AI Copilot — a warm, precise, proactive rental assistant.

CRITICAL LANGUAGE RULE: Every word of your reply MUST be in ${langName}, regardless of the language the user writes in.

Grounding: You are grounded in the user's own rental application data below. When the user asks about their score, missing documents, whether they can apply, or their report, answer directly from this data — do NOT search the web for that.

Use the \`web_search\` tool ONLY when the user asks about information that is not in their data — such as rental laws, tenancy regulations, visa/immigration rules, city-specific requirements, or employer verification standards. Never call \`web_search\` for questions answerable from the user's application data.

Be concise, encouraging, specific. Reference the user's real documents and numbers when relevant. If they ask "can I apply now?", weigh their confidence score, missing required docs, and validation issues to give a clear yes/no with reasoning.${voiceRule}

USER APPLICATION CONTEXT:
${JSON.stringify(summary, null, 2)}`;
}

async function tavilySearch(query: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return "Web search is not configured.";
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
    }),
  });
  if (!res.ok) return `Search failed: ${res.status}`;
  const j = (await res.json()) as any;
  const results = (j.results ?? [])
    .slice(0, 5)
    .map((r: any) => `- ${r.title}\n  ${r.url}\n  ${r.content?.slice(0, 400) ?? ""}`)
    .join("\n\n");
  return `Answer: ${j.answer ?? "(none)"}\n\nSources:\n${results}`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authed = await verifyBearer(request);
        const body = (await request.json()) as {
          messages?: UIMessage[];
          language?: string;
        };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const lang = body.language ?? "en";
        const gateway = createLovableAiGatewayProvider(key);

        let system: string;
        let appId: string | null = null;
        if (authed) {
          const [profile, ctx] = await Promise.all([
            loadProfile(authed.supabase, authed.userId),
            loadContext(authed.supabase, authed.userId),
          ]);
          appId = ctx.app?.id ?? null;
          system = buildSystemPrompt(lang, profile, ctx);
        } else {
          const langName = LANG_NAMES[lang] ?? "English";
          system = `You are RentReady AI Copilot. Always respond in ${langName}. The user is not signed in — encourage them to sign in so you can access their real rental application data.`;
        }

        const result = streamText({
          model: gateway(CHAT_MODEL),
          system,
          messages: await convertToModelMessages(body.messages),
          stopWhen: stepCountIs(6),
          tools: {
            web_search: tool({
              description:
                "Search the public web via Tavily for information NOT in the user's rental application data (e.g. rental laws, visa rules, city regulations, employer verification requirements).",
              inputSchema: z.object({
                query: z.string().describe("Focused search query in English."),
              }),
              execute: async ({ query }) => tavilySearch(query),
            }),
          },
          onFinish: async ({ text }) => {
            if (!authed || !appId) return;
            try {
              const last = body.messages![body.messages!.length - 1];
              const userText = last?.parts
                ?.map((p: any) => (p.type === "text" ? p.text : ""))
                .join("")
                .trim();
              const rows: any[] = [];
              if (userText) {
                rows.push({
                  application_id: appId,
                  user_id: authed.userId,
                  role: "user",
                  content: userText,
                });
              }
              if (text?.trim()) {
                rows.push({
                  application_id: appId,
                  user_id: authed.userId,
                  role: "assistant",
                  content: text,
                });
              }
              if (rows.length) await authed.supabase.from("chat_messages").insert(rows);
            } catch (err) {
              console.error("chat persist failed", err);
            }
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});
