import type { EmbeddingPlugin } from "ragpipe";

export interface GeminiEmbeddingOptions {
	apiKey: string;
	model: string;
}

export function geminiEmbedding(
	options: GeminiEmbeddingOptions,
): EmbeddingPlugin {
	const { model } = options;

	return {
		name: "gemini",
		dimensions: 3072,
		rateLimit: { delayMs: 800 },
		model,
		async embed(text: string): Promise<number[]> {
			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${options.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ content: { parts: [{ text }] } }),
				},
			);

			if (!res.ok) {
				throw new Error(
					`Gemini embedding error: ${res.status} ${await res.text()}`,
				);
			}

			const data = (await res.json()) as {
				embedding: { values: number[] };
			};
			return data.embedding.values;
		},

		async embedMany(texts: string[]): Promise<number[][]> {
			const requests = texts.map((text) => ({
				model: `models/${model}`,
				content: { parts: [{ text }] },
			}));

			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${options.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ requests }),
				},
			);

			if (!res.ok) {
				throw new Error(
					`Gemini batch embedding error: ${res.status} ${await res.text()}`,
				);
			}

			const data = (await res.json()) as {
				embeddings: { values: number[] }[];
			};
			return data.embeddings.map((e) => e.values);
		},
	};
}
