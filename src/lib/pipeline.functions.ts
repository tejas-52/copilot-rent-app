import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, VISION_MODEL, CHAT_MODEL } from "./ai-gateway.server";

// ---------- helpers ----------

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key);
}

async function downloadAsBase64(supabase: any, path: string) {
  const { data, error } = await supabase.storage.from("rental-documents").download(path);
  if (error || !data) throw new Error(`Download failed: ${error?.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  return { base64: buf.toString("base64"), mime: data.type || "application/octet-stream" };
}

async function safeObject<T>(args: Parameters<typeof generateText>[0], fallback: T): Promise<T> {
  try {
    const { output } = await generateText(args);
    return output as T;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      try { return JSON.parse(error.text ?? "") as T; } catch { return fallback; }
    }
    throw error;
  }
}

// ---------- 1. Ensure application ----------

export const getOrCreateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("applications").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing) return existing;
    const { data, error } = await supabase
      .from("applications").insert({ user_id: userId, status: "draft" })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  });

// ---------- 2. Register upload (client uploads directly to storage, then calls this) ----------

export const registerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      applicationId: z.string().uuid(),
      storagePath: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc, error } = await supabase.from("documents").insert({
      application_id: data.applicationId,
      user_id: userId,
      storage_path: data.storagePath,
      file_name: data.fileName,
      mime_type: data.mimeType,
      status: "uploaded",
    }).select().single();
    if (error) throw new Error(error.message);
    return doc;
  });

// ---------- 3-5. OCR + Classify + Extract (single vision call, saves extraction) ----------

const ExtractionSchema = z.object({
  doc_type: z.enum(["passport", "id_card", "visa", "employment_letter", "payslip", "bank_statement", "utility_bill", "reference_letter", "unknown"]),
  ocr_text: z.string(),
  fields: z.object({
    full_name: z.string().nullable(),
    date_of_birth: z.string().nullable(),
    nationality: z.string().nullable(),
    document_number: z.string().nullable(),
    issue_date: z.string().nullable(),
    expiry_date: z.string().nullable(),
    employer: z.string().nullable(),
    job_title: z.string().nullable(),
    monthly_income: z.string().nullable(),
    address: z.string().nullable(),
    visa_status: z.string().nullable(),
  }),
  confidence: z.number().min(0).max(1),
});
type Extraction = z.infer<typeof ExtractionSchema>;

export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc, error: derr } = await supabase
      .from("documents").select("*").eq("id", data.documentId).single();
    if (derr || !doc) throw new Error("Document not found");

    await supabase.from("documents").update({ status: "processing" }).eq("id", doc.id);

    try {
      const { base64, mime } = await downloadAsBase64(supabase, doc.storage_path);
      const gateway = getGateway();

      const isImage = mime.startsWith("image/");
      const content: any[] = [
        {
          type: "text",
          text: "You are a document intelligence engine for rental applications. OCR the document, classify it, and extract structured fields. Return null for missing fields.",
        },
        isImage
          ? { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
          : { type: "file", file: { filename: doc.file_name, file_data: `data:${mime};base64,${base64}` } },
      ];

      const extraction = await safeObject<Extraction>(
        {
          model: gateway(VISION_MODEL),
          messages: [{ role: "user", content }],
          output: Output.object({ schema: ExtractionSchema }),
        },
        {
          doc_type: "unknown", ocr_text: "", confidence: 0,
          fields: {
            full_name: null, date_of_birth: null, nationality: null, document_number: null,
            issue_date: null, expiry_date: null, employer: null, job_title: null,
            monthly_income: null, address: null, visa_status: null,
          },
        },
      );

      await supabase.from("extractions").insert({
        document_id: doc.id, user_id: userId,
        ocr_text: extraction.ocr_text, data: extraction.fields, confidence: extraction.confidence,
      });

      await supabase.from("documents").update({
        status: "verified", doc_type: extraction.doc_type, confidence: extraction.confidence,
      }).eq("id", doc.id);

      return { ok: true, extraction };
    } catch (e: any) {
      await supabase.from("documents").update({
        status: "error", error: e?.message ?? "Unknown error",
      }).eq("id", doc.id);
      throw e;
    }
  });

// ---------- 6. Validation engine ----------

const ValidationSchema = z.object({
  checks: z.array(z.object({ name: z.string(), passed: z.boolean(), detail: z.string() })),
  issues: z.array(z.object({ severity: z.enum(["low", "medium", "high"]), message: z.string() })),
});
type Validation = z.infer<typeof ValidationSchema>;

export const runValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ applicationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: docs } = await supabase.from("documents").select("id, doc_type, file_name")
      .eq("application_id", data.applicationId);
    const { data: extractions } = await supabase.from("extractions").select("document_id, data, confidence")
      .eq("user_id", userId);

    const gateway = getGateway();
    const validation = await safeObject<Validation>(
      {
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema: ValidationSchema }),
        prompt: `Cross-check these rental application documents for consistency (name match across passport/employment/utility, income vs employment claim, expired IDs, address mismatch). Return checks and issues.\n\nDocuments: ${JSON.stringify(docs)}\n\nExtracted fields: ${JSON.stringify(extractions)}`,
      },
      { checks: [], issues: [] },
    );

    const { data: saved } = await supabase.from("validations").insert({
      application_id: data.applicationId, user_id: userId,
      checks: validation.checks, issues: validation.issues,
    }).select().single();
    return saved;
  });

// ---------- 7. Confidence engine (deterministic) ----------

export const computeConfidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ applicationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: docs } = await supabase.from("documents").select("doc_type, confidence, status")
      .eq("application_id", data.applicationId);
    const { data: val } = await supabase.from("validations").select("issues")
      .eq("application_id", data.applicationId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const required = ["passport", "employment_letter", "payslip", "utility_bill"];
    const present = new Set((docs ?? []).filter((d: any) => d.status === "verified").map((d: any) => d.doc_type));
    const coverage = required.filter((r) => present.has(r)).length / required.length;
    const avgConf = (docs ?? []).reduce((s: number, d: any) => s + (Number(d.confidence) || 0), 0) / Math.max(1, docs?.length ?? 1);
    const issues = (val?.issues ?? []) as Array<{ severity: string }>;
    const penalty = issues.reduce((s, i) => s + (i.severity === "high" ? 15 : i.severity === "medium" ? 7 : 2), 0);
    const score = Math.max(0, Math.min(100, Math.round((coverage * 60) + (avgConf * 40) - penalty)));

    await supabase.from("applications").update({ confidence_score: score }).eq("id", data.applicationId);
    return { score, coverage, avgConfidence: avgConf, penalty };
  });

// ---------- 8. Recommendation engine ----------

const RecoSchema = z.object({
  items: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    impact: z.number(),
    eta_seconds: z.number(),
  })),
});
type Reco = z.infer<typeof RecoSchema>;

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ applicationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: app } = await supabase.from("applications").select("confidence_score")
      .eq("id", data.applicationId).single();
    const { data: docs } = await supabase.from("documents").select("doc_type, status")
      .eq("application_id", data.applicationId);
    const { data: val } = await supabase.from("validations").select("issues")
      .eq("application_id", data.applicationId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const gateway = getGateway();
    const reco = await safeObject<Reco>(
      {
        model: gateway(CHAT_MODEL),
        output: Output.object({ schema: RecoSchema }),
        prompt: `Suggest the top 3-5 actions this renter should take to improve their application. Current score: ${app?.confidence_score}. Docs: ${JSON.stringify(docs)}. Issues: ${JSON.stringify(val?.issues ?? [])}. Impact is estimated confidence gain (0-20). ETA in seconds.`,
      },
      { items: [] },
    );

    const { data: saved } = await supabase.from("recommendations").insert({
      application_id: data.applicationId, user_id: userId, items: reco.items,
    }).select().single();
    return saved;
  });

// ---------- 9. Report generator ----------

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ applicationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: app }, { data: docs }, { data: extractions }, { data: val }, { data: reco }] = await Promise.all([
      supabase.from("applications").select("*").eq("id", data.applicationId).single(),
      supabase.from("documents").select("*").eq("application_id", data.applicationId),
      supabase.from("extractions").select("*").eq("user_id", userId),
      supabase.from("validations").select("*").eq("application_id", data.applicationId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("recommendations").select("*").eq("application_id", data.applicationId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const gateway = getGateway();
    const { text: summary } = await generateText({
      model: gateway(CHAT_MODEL),
      prompt: `Write a concise landlord-facing summary (3-4 sentences) for this rental application. Score: ${app?.confidence_score}. Documents verified: ${(docs ?? []).filter((d: any) => d.status === "verified").length}. Key extracted fields: ${JSON.stringify((extractions ?? []).map((e: any) => e.data))}.`,
    });

    const content = { app, docs, extractions, validation: val, recommendations: reco, summary };
    const { data: saved } = await supabase.from("reports").insert({
      application_id: data.applicationId, user_id: userId, content,
    }).select().single();
    return saved;
  });

// ---------- Orchestrator: run full pipeline for a document ----------

export const runPipelineForDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid(), applicationId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await processDocument({ data: { documentId: data.documentId } });
    await runValidation({ data: { applicationId: data.applicationId } });
    const score = await computeConfidence({ data: { applicationId: data.applicationId } });
    await generateRecommendations({ data: { applicationId: data.applicationId } });
    return score;
  });
