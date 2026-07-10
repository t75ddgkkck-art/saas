/**
 * Client OpenAI centralisé pour Vitrix.
 *
 * Objectifs :
 *  - Un seul endroit qui parle à OpenAI (facile à remplacer par Claude/Mistral demain)
 *  - Modèle configurable via `OPENAI_MODEL` (défaut `gpt-4o-mini`)
 *  - Fallback silencieux si `OPENAI_API_KEY` manque
 *  - Support streaming (SSE) pour le chat
 *  - Logging structuré des tokens consommés (calcul coût côté /lib/ai/usage)
 *  - Timeout et retry basique
 */

import { logger } from "@/lib/logger";

export const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
export const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || "30000", 10);

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionOpts {
  messages: AiMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Signal d'abort custom (ex: AbortController) — sinon on utilise OPENAI_TIMEOUT_MS. */
  signal?: AbortSignal;
}

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}

export type AiCompletionResult =
  | { ok: true; content: string; usage: AiUsage; simulated?: false }
  | { ok: false; error: string; code?: "no_key" | "timeout" | "http_error" | "invalid_response" };

/**
 * Appel non-streaming (le plus utilisé). Retourne toujours un résultat,
 * jamais un throw : le call-site peut simplement fallback si `ok: false`.
 */
export async function aiComplete(opts: AiCompletionOpts): Promise<AiCompletionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY missing", code: "no_key" };
  }

  const model = opts.model || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  // Si l'appelant a passé son propre AbortSignal, on relaie l'abort.
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        max_tokens: opts.maxTokens ?? 400,
        temperature: opts.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      logger.warn("ai.http_error", { status: res.status, model, body: bodyText.slice(0, 200) });
      return { ok: false, error: `HTTP ${res.status}`, code: "http_error" };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const content = json.choices?.[0]?.message?.content ?? "";
    if (!content) {
      return { ok: false, error: "Empty response", code: "invalid_response" };
    }

    const usage: AiUsage = {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      totalTokens: json.usage?.total_tokens ?? 0,
      model,
    };

    logger.info("ai.completion", {
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
    });

    return { ok: true, content, usage };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("ai.timeout", { model, timeoutMs: OPENAI_TIMEOUT_MS });
      return { ok: false, error: "Timeout", code: "timeout" };
    }
    const message = err instanceof Error ? err.message : String(err);
    logger.error("ai.fetch_failed", { model, message });
    return { ok: false, error: message, code: "http_error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Version streaming : retourne un ReadableStream de tokens (SSE OpenAI décodé).
 * Utilisé par /api/ai-chat pour un rendu progressif dans le chat public.
 *
 * Le stream émet du texte plat (chunks). Le call-site le pipe dans une Response.
 */
export async function aiCompleteStream(
  opts: AiCompletionOpts
): Promise<
  | { ok: true; stream: ReadableStream<Uint8Array>; model: string }
  | { ok: false; error: string; code?: string }
> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY missing", code: "no_key" };
  }

  const model = opts.model || DEFAULT_MODEL;

  try {
    const upstream = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        max_tokens: opts.maxTokens ?? 400,
        temperature: opts.temperature ?? 0.7,
        stream: true,
      }),
      signal: opts.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const bodyText = await upstream.text().catch(() => "");
      logger.warn("ai.stream.http_error", {
        status: upstream.status,
        model,
        body: bodyText.slice(0, 200),
      });
      return { ok: false, error: `HTTP ${upstream.status}`, code: "http_error" };
    }

    // Transforme le flux SSE OpenAI en texte plat (texte des deltas concaténés).
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(data) as {
                  choices?: Array<{ delta?: { content?: string } }>;
                };
                const chunk = parsed.choices?.[0]?.delta?.content;
                if (chunk) controller.enqueue(encoder.encode(chunk));
              } catch {
                // Ligne malformée ou keepalive : on ignore
              }
            }
          }
          controller.close();
        } catch (err) {
          logger.error("ai.stream.pipe_failed", {
            message: err instanceof Error ? err.message : String(err),
          });
          controller.error(err);
        }
      },
      cancel() {
        reader.cancel().catch(() => undefined);
      },
    });

    return { ok: true, stream, model };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("ai.stream.fetch_failed", { model, message });
    return { ok: false, error: message, code: "http_error" };
  }
}
