import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";
import { callMistral } from "./providers/mistral";
import {
  detectProvider,
  getFailoverChain,
  resolvedTaskType,
  Provider,
  TaskType,
} from "./router";
import { logRequest, getStats } from "./logger";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function callProvider(provider: Provider, prompt: string, env: any) {
  switch (provider) {
    case "gemini":  return callGemini(prompt, env);
    case "groq":    return callGroq(prompt, env);
    case "mistral": return callMistral(prompt, env);
  }
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── GET /stats ────────────────────────────────────────────────────────────
    if (request.method === "GET" && url.pathname === "/stats") {
      try {
        const stats = await getStats(env);
        return json(stats);
      } catch (e: any) {
        return json({ error: "Failed to load stats", detail: e.message }, 500);
      }
    }

    // ── POST /chat ────────────────────────────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/chat") {
      // Auth check
      let body: any;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const providedKey =
        request.headers.get("Authorization")?.replace("Bearer ", "") ??
        body?.api_key;

      if (!providedKey || providedKey !== env.GATEWAY_API_KEY) {
        return json({ error: "Unauthorized" }, 401);
      }

      const message: string = body?.message;
      const task_type: TaskType = body?.task_type ?? "auto";

      if (!message || typeof message !== "string" || message.trim() === "") {
        return json({ error: "Missing or empty 'message' field" }, 400);
      }

      const validTypes: TaskType[] = ["speed", "quality", "long", "code", "auto"];
      if (!validTypes.includes(task_type)) {
        return json({ error: `Invalid task_type. Must be one of: ${validTypes.join(", ")}` }, 400);
      }

      const request_id = crypto.randomUUID();
      const start = Date.now();
      const detectedType = resolvedTaskType(task_type, message);
      const primaryProvider = detectProvider(message, task_type);
      const chain = getFailoverChain(primaryProvider);

      let lastError = "";
      let providerUsed: Provider | null = null;
      let fallback_used = false;
      let responseText = "";
      let tokens = 0;

      for (let i = 0; i < chain.length; i++) {
        const provider = chain[i];
        try {
          const result = await callProvider(provider, message, env);
          responseText = result.text;
          tokens = result.tokens;
          providerUsed = provider;
          fallback_used = i > 0;
          break;
        } catch (e: any) {
          lastError = e.message;
          // Continue to next in chain
        }
      }

      const latency_ms = Date.now() - start;

      if (!providerUsed) {
        // All providers failed — still log it
        ctx.waitUntil(
          logRequest(
            {
              request_id,
              timestamp: Date.now(),
              provider: primaryProvider,
              task_type: detectedType,
              latency_ms,
              tokens: 0,
              success: false,
              fallback_used: true,
              error: lastError,
            },
            env
          )
        );
        return json(
          {
            error: "All providers failed",
            detail: lastError,
            request_id,
          },
          502
        );
      }

      // Log success
      ctx.waitUntil(
        logRequest(
          {
            request_id,
            timestamp: Date.now(),
            provider: providerUsed,
            task_type: detectedType,
            latency_ms,
            tokens,
            success: true,
            fallback_used,
          },
          env
        )
      );

      return json({
        response: responseText,
        provider_used: providerUsed,
        task_type_detected: detectedType,
        fallback_used,
        latency_ms,
        tokens_used: tokens,
        request_id,
      });
    }

    // ── 404 ───────────────────────────────────────────────────────────────────
    return json({ error: "Not found. Available: POST /chat, GET /stats" }, 404);
  },
};
