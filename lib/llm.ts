// OpenRouter for the BFF (U3 categories; story and chat in U4 and U7). Server only. Payment text goes into
// prompts as JSON data, never as instructions (NF-6); callers check every answer against what they allow.
const url = "https://openrouter.ai/api/v1/chat/completions";
export const MODEL = "anthropic/claude-haiku-5.5";

export class LlmError extends Error {}

/** Asks for one JSON object and returns its text. Logs the tokens of every call (NF-12). */
export type AskJson = (purpose: string, system: string, user: string) => Promise<string>;

/** Chat's picker (U16): reads the question and calls functions. Low effort keeps it quick and cheap. */
export const PICKER_MODEL = "anthropic/claude-opus-5.5";
export type ToolCall = { id: string; name: string; args: string };
/** What the picker said: its text, its function calls, and the message to send back in the next round. */
export type Picked = { text: string; calls: ToolCall[]; message: object };
export type AskTools = (system: string, messages: object[], tools: object[]) => Promise<Picked>;

export const askTools: AskTools = async (system, messages, tools) => {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: PICKER_MODEL,
      max_tokens: 2000,
      reasoning: { effort: "low" },
      tools,
      tool_choice: "auto",
      // The functions and rules never change, so they're cached; the question and its data come after them.
      messages: [{ role: "system", content: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] }, ...messages],
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new LlmError(`OpenRouter returned ${r.status}`);
  const j = (await r.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
    usage?: { prompt_tokens: number; completion_tokens: number; cost?: number; prompt_tokens_details?: { cached_tokens?: number } };
  };
  console.info(`llm chat-pick ${PICKER_MODEL} in=${j.usage?.prompt_tokens} cached=${j.usage?.prompt_tokens_details?.cached_tokens} out=${j.usage?.completion_tokens} usd=${j.usage?.cost}`);
  const message = j.choices?.[0]?.message;
  if (!message) throw new LlmError("OpenRouter returned no answer");
  return { text: message.content ?? "", calls: (message.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, args: c.function.arguments })), message };
};

/** Dollars left on the key, or null when OpenRouter doesn't say. The key's limit is the real cap on spending. */
export async function creditLeft(): Promise<number | null> {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }, cache: "no-store" });
    const left = ((await r.json()) as { data?: { limit_remaining?: number | null } }).data?.limit_remaining;
    return r.ok && typeof left === "number" ? left : null;
  } catch {
    return null;
  }
}

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
  const j = (await r.json()) as { choices?: { finish_reason?: string; message?: { content?: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number; cost?: number } };
  console.info(`llm ${purpose} ${MODEL} in=${j.usage?.prompt_tokens} out=${j.usage?.completion_tokens} usd=${j.usage?.cost}`); // one string, so the dev log file keeps it
  const text = j.choices?.[0]?.message?.content;
  // Some answers come wrapped in a ```json fence even with response_format, so keep the outer object.
  const start = text?.indexOf("{") ?? -1;
  if (!text || start < 0) throw new LlmError(`OpenRouter returned no answer (finish=${j.choices?.[0]?.finish_reason}, ${text?.length ?? 0} characters, starts ${JSON.stringify(text?.slice(0, 80))})`);
  return text.slice(start, text.lastIndexOf("}") + 1);
};
