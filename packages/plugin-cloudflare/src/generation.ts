import type { GenerationPlugin } from "ragpipe";

export interface CloudflareGenerationOptions {
	accountId: string;
	apiToken: string;
	model?: string;
	systemPrompt?: string;
}

interface CloudflareMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface CloudflareResponse {
	result: { response: string };
	success: boolean;
}

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export function cloudflareGeneration(
	options: CloudflareGenerationOptions,
): GenerationPlugin {
	const model = options.model ?? DEFAULT_MODEL;
	const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/run/${model}`;

	function buildMessages(
		question: string,
		context: string,
		opts?: { history?: string; systemPrompt?: string },
	): CloudflareMessage[] {
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
		name: "cloudflare",

		async generate(question, context, opts) {
			const messages = buildMessages(question, context, opts);

			const res = await fetch(baseUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${options.apiToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ messages, stream: false }),
			});

			if (!res.ok) {
				throw new Error(
					`Cloudflare generation error: ${res.status} ${await res.text()}`,
				);
			}

			const data = (await res.json()) as CloudflareResponse;

			if (!data.success) {
				throw new Error(
					"Cloudflare generation error: API returned success=false",
				);
			}

			return data.result.response;
		},

		async *generateStream(question, context, opts) {
			const messages = buildMessages(question, context, opts);

			const res = await fetch(baseUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${options.apiToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ messages, stream: true }),
			});

			if (!res.ok) {
				throw new Error(
					`Cloudflare generation stream error: ${res.status} ${await res.text()}`,
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
							const data = JSON.parse(payload) as { response: string };
							if (data.response) yield data.response;
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
