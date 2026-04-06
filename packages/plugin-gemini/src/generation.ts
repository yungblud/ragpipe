import type { GenerationPlugin } from "ragpipe";

export interface GeminiGenerationOptions {
	apiKey: string;
	model?: string;
	systemPrompt?: string;
}

interface GeminiCandidate {
	content: { parts: { text: string }[] };
}

interface GeminiResponse {
	candidates: GeminiCandidate[];
}

export function geminiGeneration(
	options: GeminiGenerationOptions,
): GenerationPlugin {
	const model = options.model ?? "gemini-2.5-flash";

	function buildBody(
		question: string,
		context: string,
		opts?: { history?: string; systemPrompt?: string },
	) {
		const systemPrompt =
			opts?.systemPrompt ??
			options.systemPrompt ??
			"Answer based on the provided context.";

		let userPrompt = `Context:\n${context}\n\nQuestion: ${question}`;
		if (opts?.history) {
			userPrompt = `Conversation history:\n${opts.history}\n\n${userPrompt}`;
		}

		return {
			contents: [{ parts: [{ text: userPrompt }] }],
			systemInstruction: { parts: [{ text: systemPrompt }] },
		};
	}

	return {
		name: "gemini",

		async generate(question, context, opts) {
			const body = buildBody(question, context, opts);

			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
			);

			if (!res.ok) {
				throw new Error(
					`Gemini generation error: ${res.status} ${await res.text()}`,
				);
			}

			const data = (await res.json()) as GeminiResponse;
			return data.candidates[0].content.parts[0].text;
		},

		async *generateStream(question, context, opts) {
			const body = buildBody(question, context, opts);

			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${options.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				},
			);

			if (!res.ok) {
				throw new Error(
					`Gemini generation stream error: ${res.status} ${await res.text()}`,
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
						try {
							const data = JSON.parse(line.slice(6)) as GeminiResponse;
							const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
							if (text) yield text;
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
