// Thin Browserbase REST wrapper — fetch only, Workers-safe.
const BB = "https://api.browserbase.com/v1";

function auth() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) throw new Error("Browserbase not configured");
  return { apiKey, projectId };
}

export type BBSession = {
  id: string;
  connectUrl: string;
};

export async function createSession(): Promise<BBSession> {
  const { apiKey, projectId } = auth();
  const res = await fetch(`${BB}/sessions`, {
    method: "POST",
    headers: {
      "X-BB-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      browserSettings: {
        viewport: { width: 1280, height: 800 },
      },
      keepAlive: false,
    }),
  });
  if (!res.ok) throw new Error(`Browserbase session failed: ${res.status} ${await res.text()}`);
  const j = (await res.json()) as { id: string; connectUrl: string };
  return { id: j.id, connectUrl: j.connectUrl };
}

export async function getLiveViewUrl(sessionId: string): Promise<string> {
  const { apiKey } = auth();
  const res = await fetch(`${BB}/sessions/${sessionId}/debug`, {
    headers: { "X-BB-API-Key": apiKey },
  });
  if (!res.ok) throw new Error(`Browserbase debug failed: ${res.status}`);
  const j = (await res.json()) as { debuggerFullscreenUrl?: string; debuggerUrl?: string };
  return j.debuggerFullscreenUrl || j.debuggerUrl || "";
}

export async function stopSession(sessionId: string): Promise<void> {
  const { apiKey, projectId } = auth();
  await fetch(`${BB}/sessions/${sessionId}`, {
    method: "POST",
    headers: { "X-BB-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, status: "REQUEST_RELEASE" }),
  }).catch(() => {});
}
