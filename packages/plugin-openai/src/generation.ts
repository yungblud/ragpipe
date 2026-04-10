import type { GenerationPlugin } from "ragpipe";

export interface OpenAIGenerationOptions {
	apiKey: string;
	model?: string;
	systemPrompt?: string;
	baseUrl?: string;
}

interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface ChatChoice {
	index: number;
	message: {
		role: string;
		content: string | null;
	};
	finish_reason: string | null;
}

interface ChatCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: ChatChoice[];
}

const DEFAULT_MODEL = "gpt-4o-mini";

export function openaiGeneration(
	options: OpenAIGenerationOptions,
): GenerationPlugin {
	const model = options.model ?? DEFAULT_MODEL;
	const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";

	function buildMessages(
		question: string,
		context: string,
		opts?: { history?: string; systemPrompt?: string },
	): ChatMessage[] {
		const systemPrompt =
			opts?.systemPrompt ??
			options.systemPrompt ??
			"Answer based on the provided context.";

		let userPrompt = `Context:\n${context}\n\nQuestion: ${question}`;
		if (opts?.history) {
			userPrompt = `Conversation history:\n${opts.history}\n\n${userPrompt}`;
		}

		return [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		];
	}

	return {
		name: "openai",
		model,

		async generate(question, context, opts) {
			const messages = buildMessages(question, context, opts);

			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${options.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ model, messages, stream: false }),
			});

			if (!res.ok) {
				throw new Error(
					`OpenAI generation error: ${res.status} ${await res.text()}`,
				);
			}

			const data = (await res.json()) as ChatCompletionResponse;
			return data.choices?.[0]?.message?.content ?? "";
		},

		async *generateStream(question, context, opts) {
			const messages = buildMessages(question, context, opts);

			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${options.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ model, messages, stream: true }),
			});

			if (!res.ok) {
				throw new Error(
					`OpenAI generation stream error: ${res.status} ${await res.text()}`,
				);
			}

			const reader = res.body?.getReader();
			if (!reader) throw new Error("No response body");

			const decoder = new TextDecoder();
			let buffer = "";

			try {
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						if (!line.startsWith("data: ")) continue;
						const payload = line.slice(6).trim();
						if (payload === "[DONE]") return;
						try {
							const data = JSON.parse(payload) as {
								choices?: Array<{ delta?: { content?: string } }>;
							};
							const chunk = data.choices?.[0]?.delta?.content;
							if (chunk) yield chunk;
						} catch {
							// skip malformed SSE chunks
						}
					}
				}
			} finally {
				reader.releaseLock();
			}
		},
	};
}
