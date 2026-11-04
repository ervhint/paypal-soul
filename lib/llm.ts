// OpenRouter for the BFF (U3 categories; story and chat in U4 and U7). Server only. Payment text goes into
// prompts as JSON data, never as instructions (NF-6); callers check every answer against what they allow.
const url = "https://openrouter.ai/api/v1/chat/completions";
export const MODEL = "anthropic/claude-haiku-5.5";

export class LlmError extends Error {}

/** Asks for one JSON object and returns its text. Logs the tokens of every call (NF-12). */
export type AskJson = (purpose: string, system: string, user: string) => Promise<string>;

export const askJson: AskJson = async (purpose, system, user) => {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new LlmError(`OpenRouter returned ${r.status}`);
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number; cost?: number } };
  console.info(`llm ${purpose} ${MODEL} in=${j.usage?.prompt_tokens} out=${j.usage?.completion_tokens} usd=${j.usage?.cost}`); // one string, so the dev log file keeps it
  const text = j.choices?.[0]?.message?.content;
  // Some answers come wrapped in a ```json fence even with response_format, so keep the outer object.
  const start = text?.indexOf("{") ?? -1;
  if (!text || start < 0) throw new LlmError("OpenRouter returned no answer");
  return text.slice(start, text.lastIndexOf("}") + 1);
};
