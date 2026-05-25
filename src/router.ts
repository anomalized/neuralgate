export type TaskType = "speed" | "quality" | "long" | "code" | "auto";
export type Provider = "gemini" | "groq" | "mistral";

const CODE_KEYWORDS = [
  "function", "class", "const ", "let ", "var ", "def ", "return",
  "import ", "export ", "async ", "await", "console.", "print(",
  "debug", "compile", "syntax", "algorithm", "refactor", "bug",
  "error:", "exception", "stack", "array", "object", "typescript",
  "javascript", "python", "rust", "golang", "sql", "regex",
  "```", "code", "implement", "write a function", "write a class",
];

const SPEED_KEYWORDS = [
  "fast", "quick", "quickly", "brief", "short", "tldr", "summarize briefly",
  "in one sentence", "simple", "rapid", "instant",
];

export function detectProvider(message: string, taskType: TaskType): Provider {
  if (taskType !== "auto") {
    return taskTypeToProvider(taskType);
  }

  const lower = message.toLowerCase();

  // Check speed signals
  if (SPEED_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "groq";
  }

  // Long context check
  if (message.length > 500) {
    return "gemini";
  }

  // Code check
  if (CODE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "groq";
  }

  // Default
  return "gemini";
}

export function taskTypeToProvider(taskType: TaskType): Provider {
  switch (taskType) {
    case "speed": return "groq";
    case "quality": return "gemini";
    case "long": return "gemini";
    case "code": return "groq";
    default: return "gemini";
  }
}

// Failover chain order
export function getFailoverChain(primary: Provider): Provider[] {
  const chain: Provider[] = ["gemini", "groq", "mistral"];
  // Put primary first, then others in default order
  const rest = chain.filter((p) => p !== primary);
  return [primary, ...rest];
}

export function resolvedTaskType(taskType: TaskType, message: string): TaskType {
  if (taskType !== "auto") return taskType;

  const lower = message.toLowerCase();

  if (SPEED_KEYWORDS.some((kw) => lower.includes(kw))) return "speed";
  if (message.length > 500) return "long";
  if (CODE_KEYWORDS.some((kw) => lower.includes(kw))) return "code";

  return "quality";
}
