import type { EmbeddingPlugin } from "ragpipe";

export interface OpenAIEmbeddingOptions {
	apiKey: string;
	model?: string;
	dimensions?: number;
	baseUrl?: string;
}

const DEFAULT_MODEL = "text-embedding-3-small";

const DIMENSION_MAP: Record<string, number> = {
	"text-embedding-3-small": 1536,
	"text-embedding-3-large": 3072,
	"text-embedding-ada-002": 1536,
};

export function openaiEmbedding(
	options: OpenAIEmbeddingOptions,
): EmbeddingPlugin {
	const model = options.model ?? DEFAULT_MODEL;
	const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
	const dimensions = options.dimensions ?? DIMENSION_MAP[model] ?? 1536;

	async function callApi(input: string | string[]): Promise<number[][]> {
		const body: Record<string, unknown> = { model, input };

		if (options.dimensions && model.startsWith("text-embedding-3-")) {
			body.dimensions = options.dimensions;
		}

		const res = await fetch(`${baseUrl}/embeddings`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${options.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			throw new Error(
				`OpenAI embedding error: ${res.status} ${await res.text()}`,
			);
		}

		const data = (await res.json()) as {
			data: { embedding: number[]; index: number }[];
		};

		return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
	}

	return {
		name: "openai",
		dimensions,
		model,
		rateLimit: { delayMs: 200 },

		async embed(text: string): Promise<number[]> {
			const vectors = await callApi(text);
			return vectors[0];
		},

		async embedMany(texts: string[]): Promise<number[][]> {
			return callApi(texts);
		},
	};
}
