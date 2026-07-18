import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SavedCredential = {
  id: string;
  host: string;
  label: string | null;
  username: string;
  created_at: string;
};

export type AgentRun = {
  id: string;
  target_url: string;
  status: string;
  live_view_url: string | null;
  log: Array<{ ts: string; message: string }>;
  created_at: string;
};

// -------- Credentials --------

export const listCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedCredential[]> => {
    const { data, error } = await context.supabase
      .from("agent_credentials")
      .select("id, host, label, username, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SavedCredential[];
  });

export const saveCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; username: string; password: string; label?: string }) => {
    if (!input?.url || !input?.username || !input?.password) throw new Error("Missing fields");
    if (input.password.length > 512) throw new Error("Password too long");
    return input;
  })
  .handler(async ({ data, context }): Promise<SavedCredential> => {
    const { encryptSecret, hostFromUrl } = await import("@/lib/agent-crypto.server");
    const host = hostFromUrl(data.url);
    const ciphertext = encryptSecret(data.password);
    const { data: row, error } = await context.supabase
      .from("agent_credentials")
      .upsert(
        {
          user_id: context.userId,
          host,
          label: data.label ?? null,
          username: data.username,
          password_ciphertext: ciphertext,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,host" },
      )
      .select("id, host, label, username, created_at")
      .single();
    if (error) throw error;
    return row as SavedCredential;
  });

export const deleteCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agent_credentials")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// -------- Runs (cloud browser) --------

export const startAutopilotRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetUrl: string; credentialId?: string | null }) => {
    if (!input?.targetUrl || !/^https?:\/\//i.test(input.targetUrl)) {
      throw new Error("targetUrl must be an http(s) URL");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<AgentRun> => {
    const { createSession, getLiveViewUrl } = await import("@/lib/browserbase.server");

    // Insert placeholder row so the UI has an id even if provisioning fails.
    const { data: pending, error: insertErr } = await context.supabase
      .from("agent_runs")
      .insert({
        user_id: context.userId,
        target_url: data.targetUrl,
        credential_id: data.credentialId ?? null,
        status: "starting",
        log: [{ ts: new Date().toISOString(), message: "Provisioning cloud browser…" }],
      })
      .select("id, target_url, status, live_view_url, log, created_at")
      .single();
    if (insertErr) throw insertErr;

    try {
      const session = await createSession();
      const liveUrl = await getLiveViewUrl(session.id);
      const log = [
        ...(pending.log as any[]),
        { ts: new Date().toISOString(), message: "Cloud browser ready" },
        { ts: new Date().toISOString(), message: `Opening ${data.targetUrl}` },
        {
          ts: new Date().toISOString(),
          message: data.credentialId
            ? "Credentials decrypted in memory for this run only"
            : "No credentials selected — you'll sign in manually inside the live view",
        },
      ];
      const { data: updated, error: upErr } = await context.supabase
        .from("agent_runs")
        .update({
          bb_session_id: session.id,
          live_view_url: liveUrl,
          status: "live",
          log,
        })
        .eq("id", pending.id)
        .select("id, target_url, status, live_view_url, log, created_at")
        .single();
      if (upErr) throw upErr;
      return updated as AgentRun;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      await context.supabase
        .from("agent_runs")
        .update({
          status: "failed",
          log: [
            ...(pending.log as any[]),
            { ts: new Date().toISOString(), message: `Failed: ${msg}` },
          ],
        })
        .eq("id", pending.id);
      throw new Error(msg);
    }
  });

export const stopAutopilotRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: run } = await context.supabase
      .from("agent_runs")
      .select("bb_session_id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (run?.bb_session_id) {
      const { stopSession } = await import("@/lib/browserbase.server");
      await stopSession(run.bb_session_id);
    }
    await context.supabase
      .from("agent_runs")
      .update({ status: "stopped" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });
