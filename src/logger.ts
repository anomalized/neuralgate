import { Provider, TaskType } from "./router";

export interface LogEntry {
  request_id: string;
  timestamp: number;
  provider: Provider;
  task_type: TaskType;
  latency_ms: number;
  tokens: number;
  success: boolean;
  fallback_used: boolean;
  error?: string;
}

export async function logRequest(entry: LogEntry, env: any): Promise<void> {
  const key = `log:${entry.timestamp}:${entry.request_id}`;
  await env.LOGS.put(key, JSON.stringify(entry), { expirationTtl: 604800 });

  // Increment counters
  await incrementCounter(`count:${entry.provider}`, env);
  await incrementCounter("count:total", env);
  if (!entry.success) {
    await incrementCounter("count:failures", env);
  }
}

async function incrementCounter(key: string, env: any): Promise<void> {
  const current = await env.LOGS.get(key);
  const val = current ? parseInt(current, 10) : 0;
  await env.LOGS.put(key, String(val + 1));
}

export async function getStats(env: any): Promise<any> {
  const [total, gemini, groq, mistral, failures] = await Promise.all([
    env.LOGS.get("count:total"),
    env.LOGS.get("count:gemini"),
    env.LOGS.get("count:groq"),
    env.LOGS.get("count:mistral"),
    env.LOGS.get("count:failures"),
  ]);

  // Fetch last 10 log entries by listing keys
  const listed = await env.LOGS.list({ prefix: "log:" });
  const keys: string[] = (listed?.keys ?? []).map((k: any) => k.name);

  // Sort descending by timestamp embedded in key: log:{timestamp}:{id}
  keys.sort((a: string, b: string) => {
    const ta = parseInt(a.split(":")[1] ?? "0", 10);
    const tb = parseInt(b.split(":")[1] ?? "0", 10);
    return tb - ta;
  });

  const last10Keys = keys.slice(0, 10);
  const entries = await Promise.all(
    last10Keys.map(async (k) => {
      const v = await env.LOGS.get(k);
      return v ? JSON.parse(v) : null;
    })
  );

  return {
    total_requests: parseInt(total ?? "0", 10),
    by_provider: {
      gemini: parseInt(gemini ?? "0", 10),
      groq: parseInt(groq ?? "0", 10),
      mistral: parseInt(mistral ?? "0", 10),
    },
    failures: parseInt(failures ?? "0", 10),
    last_10_requests: entries.filter(Boolean),
  };
}
