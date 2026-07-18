import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VISION_MODEL } from "@/lib/ai-gateway.server";

export type AgentField = {
  label: string;
  value: string;
  status: "filled" | "review" | "missing";
  source?: string;
  note?: string;
};

export type AgentResult = {
  form_title: string;
  fields: AgentField[];
  summary: string;
};

const SYSTEM = `You are RentReady Application Agent. You receive a rental application form (image or PDF) and the user's known profile & extracted document data. Your job:
1. Detect EVERY field on the form (labels/questions).
2. For each field, try to auto-fill it from the user's data.
3. Classify each field's status:
   - "filled": you are confident (>=90%) of the value from the user's data.
   - "review": partial match, ambiguous, or inferred — user should confirm.
   - "missing": no data available in the user's profile to answer this.
4. Never fabricate. If data is not present, use empty value and status "missing".
5. Preserve the field ordering from the form.
6. Include the "source" (which piece of user data or document field the answer came from) when status is filled or review.

Return STRICT JSON only, matching this schema — no markdown, no prose:
{
  "form_title": string,
  "summary": string,   // 1-sentence overview e.g. "12 of 18 fields auto-filled from your profile."
  "fields": [
    { "label": string, "value": string, "status": "filled"|"review"|"missing", "source"?: string, "note"?: string }
  ]
}`;

function buildUserBlock(profile: any, extractions: any[]) {
  const extracted = extractions
    .map((e: any) => e?.data)
    .filter(Boolean)
    .reduce((acc: Record<string, any>, cur: any) => ({ ...acc, ...cur }), {});
  return {
    profile: {
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      country: profile?.country ?? null,
      rental_country: profile?.rental_country ?? null,
      employment_status: profile?.employment_status ?? null,
      preferred_language: profile?.preferred_language ?? null,
    },
    extracted_document_fields: extracted,
  };
}

function isPdfDataUrl(dataUrl: string) {
  return dataUrl.startsWith("data:application/pdf");
}

export const runApplicationAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileDataUrl: string; fileName: string }) => {
    if (!input?.fileDataUrl?.startsWith("data:")) {
      throw new Error("fileDataUrl must be a data: URL");
    }
    if (input.fileDataUrl.length > 20 * 1024 * 1024) {
      throw new Error("File too large (max ~15 MB).");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<AgentResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { supabase, userId } = context;

    const [{ data: profile }, { data: extractions }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, country, rental_country, employment_status, preferred_language")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("extractions").select("data, confidence").eq("user_id", userId),
    ]);

    const userBlock = buildUserBlock(profile, extractions ?? []);

    const contentBlock = isPdfDataUrl(data.fileDataUrl)
      ? {
          type: "file",
          file: { filename: data.fileName || "application.pdf", file_data: data.fileDataUrl },
        }
      : { type: "image_url", image_url: { url: data.fileDataUrl } };

    const body = {
      model: VISION_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `USER DATA (JSON):\n${JSON.stringify(userBlock, null, 2)}\n\nAnalyze the attached rental application form and produce the JSON.`,
            },
            contentBlock,
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("Agent gateway failed", res.status, err);
      throw new Error(`Agent failed: ${res.status}`);
    }
    const j = (await res.json()) as any;
    const text: string = j?.choices?.[0]?.message?.content ?? "";
    let parsed: AgentResult;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Sometimes models wrap in ```json fences; strip
      const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    }

    // Normalize
    const fields = Array.isArray(parsed.fields) ? parsed.fields : [];
    const normalized: AgentResult = {
      form_title: parsed.form_title || "Rental Application",
      summary: parsed.summary || "",
      fields: fields.map((f) => ({
        label: String(f.label ?? "Field"),
        value: String(f.value ?? ""),
        status: (["filled", "review", "missing"].includes(f.status) ? f.status : "review") as AgentField["status"],
        source: f.source ? String(f.source) : undefined,
        note: f.note ? String(f.note) : undefined,
      })),
    };
    return normalized;
  });
