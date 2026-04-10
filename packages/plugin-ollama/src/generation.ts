import type { GenerationPlugin } from "ragpipe";

export interface OllamaGenerationOptions {
	model: string;
	baseUrl?: string;
	systemPrompt?: string;
}

interface OllamaChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface OllamaChatResponse {
	model: string;
	message: { role: string; content: string };
	done: boolean;
}

export function ollamaGeneration(
	options: OllamaGenerationOptions,
): GenerationPlugin {
	const { model } = options;
	const baseUrl = options.baseUrl ?? "http://localhost:11434";

	function buildMessages(
		question: string,
		context: string,
		opts?: { history?: string; systemPrompt?: string },
	): OllamaChatMessage[] {
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

	async function callChat(
		messages: OllamaChatMessage[],
		stream: boolean,
	): Promise<Response> {
		let res: Response;
		try {
			res = await fetch(`${baseUrl}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model, messages, stream }),
			});
		} catch {
			throw new Error(
				`Ollama server not reachable at ${baseUrl}. Run "ollama serve" to start the server.`,
			);
		}

		if (res.status === 404) {
			throw new Error(
				`Model "${model}" not found. Run "ollama pull ${model}" to download the model.`,
			);
		}

		if (!res.ok) {
			throw new Error(
				`Ollama generation error: ${res.status} ${await res.text()}`,
			);
		}

		return res;
	}

	return {
		name: "ollama",
		model,

		async generate(question, context, opts) {
			const messages = buildMessages(question, context, opts);
			const res = await callChat(messages, false);
			const data = (await res.json()) as OllamaChatResponse;
			return data.message?.content ?? "";
		},

		async *generateStream(question, context, opts) {
			const messages = buildMessages(question, context, opts);
			const res = await callChat(messages, true);

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
						if (!line.trim()) continue;
						const data = JSON.parse(line) as OllamaChatResponse;
						if (data.message?.content) yield data.message.content;
						if (data.done) return;
					}
				}
			} finally {
				reader.releaseLock();
			}
		},
	};
}
