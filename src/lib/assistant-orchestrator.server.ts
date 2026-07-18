import { generateText } from "ai";
import { createLovableAiGatewayProvider, CHAT_MODEL } from "@/lib/ai-gateway.server";

export type RouteDecision = {
  mode: "rag" | "web" | "both" | "none";
  search_query?: string;
  reason?: string;
};

/**
 * Lightweight keyword-based retrieval over the user's extracted document fields
 * and profile. Returns the most relevant snippets first so the LLM sees the
 * signal without the full context blob dominating the prompt.
 */
export function retrieveRelevantSnippets(
  query: string,
  ctx: { docs: any[]; extractions: any[]; validation: any; recommendations: any },
  limit = 8,
): { source: string; text: string; score: number }[] {
  const q = query.toLowerCase();
  const terms = Array.from(new Set(q.split(/[^a-z0-9äöüß]+/i).filter((t) => t.length > 2)));
  const score = (text: string) => {
    if (!text) return 0;
    const t = text.toLowerCase();
    let s = 0;
    for (const term of terms) if (t.includes(term)) s += 1;
    return s;
  };
  const items: { source: string; text: string; score: number }[] = [];

  for (const d of ctx.docs ?? []) {
    const text = `Document: ${d.file_name} (type: ${d.doc_type}, status: ${d.status}, confidence: ${d.confidence ?? "n/a"})${d.error ? `, error: ${d.error}` : ""}`;
    items.push({ source: "documents", text, score: score(text) + 0.1 });
  }
  for (const e of ctx.extractions ?? []) {
    const text = `Extracted fields: ${JSON.stringify(e.data)}`;
    items.push({ source: "extractions", text, score: score(text) + 0.1 });
  }
  for (const issue of ctx.validation?.issues ?? []) {
    const text = `Validation issue: ${JSON.stringify(issue)}`;
    items.push({ source: "validation", text, score: score(text) + 0.2 });
  }
  for (const rec of ctx.recommendations?.items ?? []) {
    const text = `Recommendation: ${JSON.stringify(rec)}`;
    items.push({ source: "recommendations", text, score: score(text) + 0.2 });
  }

  items.sort((a, b) => b.score - a.score);
  const top = items.filter((i) => i.score > 0).slice(0, limit);
  // Always include at least a few high-signal rows even if terms didn't match.
  if (top.length < 3) {
    for (const it of items) {
      if (top.length >= 3) break;
      if (!top.includes(it)) top.push(it);
    }
  }
  return top;
}

/**
 * Small, fast router call. Decides whether the user's question can be answered
 * from their own data (RAG), needs external info (web), or both. Falls back
 * to a safe heuristic if the router LLM fails.
 */
export async function routeQuery(
  apiKey: string,
  userQuery: string,
  ctx: { docs: any[]; extractions: any[]; validation: any; recommendations: any; app: any },
): Promise<RouteDecision> {
  const heuristic = (): RouteDecision => {
    const q = userQuery.toLowerCase();
    const externalHints = [
      "law", "gesetz", "regulation", "visa", "tax", "steuer", "market", "average rent",
      "price", "district", "neighborhood", "schufa rule", "tenancy law", "immigration",
      "requirement", "city", "how much", "typical", "current",
    ];
    const internalHints = [
      "my ", "mein", "मेरा", "मेरी", "score", "document", "dokument", "report",
      "confidence", "missing", "can i apply", "ready", "application",
    ];
    const wantsExternal = externalHints.some((h) => q.includes(h));
    const wantsInternal = internalHints.some((h) => q.includes(h)) || (ctx.docs?.length ?? 0) > 0;
    if (wantsExternal && wantsInternal) return { mode: "both", search_query: userQuery, reason: "heuristic" };
    if (wantsExternal) return { mode: "web", search_query: userQuery, reason: "heuristic" };
    return { mode: "rag", reason: "heuristic" };
  };

  try {
    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: gateway(CHAT_MODEL),
      system:
        "You are a routing classifier. Decide how to answer the user's question. " +
        "Prefer the user's own data whenever possible. Only choose web/both when the question requires public info (laws, regulations, market prices, city rules, visa rules) not in their application. " +
        'Reply with STRICT JSON only: {"mode":"rag|web|both|none","search_query":"...optional...","reason":"short"}',
      prompt: `USER QUESTION: ${userQuery}\n\nUSER HAS: ${ctx.docs?.length ?? 0} docs, ${ctx.extractions?.length ?? 0} extractions, app=${ctx.app ? "yes" : "no"}.`,
    });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return heuristic();
    const parsed = JSON.parse(match[0]) as RouteDecision;
    if (!["rag", "web", "both", "none"].includes(parsed.mode)) return heuristic();
    if ((parsed.mode === "web" || parsed.mode === "both") && !parsed.search_query) {
      parsed.search_query = userQuery;
    }
    return parsed;
  } catch {
    return heuristic();
  }
}

export async function tavilySearch(query: string): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return "Web search is not configured.";
  try {
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
  } catch (err) {
    return `Search error: ${(err as Error).message}`;
  }
}
