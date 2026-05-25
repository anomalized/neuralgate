import { ProviderResponse } from "./gemini";

export async function callMistral(prompt: string, env: any): Promise<ProviderResponse> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral error ${res.status}: ${err}`);
  }

  const data: any = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Mistral returned empty response");

  const tokens =
    (data?.usage?.prompt_tokens ?? 0) + (data?.usage?.completion_tokens ?? 0);

  return { text, tokens };
}
