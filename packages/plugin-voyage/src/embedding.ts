import type { EmbeddingPlugin } from "ragpipe";

export type VoyageEmbeddingInputType = "query" | "document";

export interface VoyageEmbeddingOptions {
	apiKey: string;
	model: string;
	dimensions: number;
	baseUrl?: string;
	inputType?: VoyageEmbeddingInputType;
}

interface VoyageEmbeddingResponseItem {
	index: number;
	embedding: number[];
}

interface VoyageEmbeddingResponse {
	data: VoyageEmbeddingResponseItem[];
}

function isValidEmbeddingItem(
	value: unknown,
): value is VoyageEmbeddingResponseItem {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const item = value as Record<string, unknown>;

	return (
		typeof item.index === "number" &&
		Array.isArray(item.embedding) &&
		item.embedding.every((entry) => typeof entry === "number")
	);
}

export function voyageEmbedding(
	options: VoyageEmbeddingOptions,
): EmbeddingPlugin {
	const model = options.model;
	const baseUrl = options.baseUrl ?? "https://api.voyageai.com/v1";
	const dimensions = options.dimensions;

	async function callApi(input: string | string[]): Promise<number[][]> {
		const body: Record<string, unknown> = {
			model,
			input,
			output_dimension: options.dimensions,
		};

		if (options.inputType) {
			body.input_type = options.inputType;
		}

		const response = await fetch(`${baseUrl}/embeddings`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${options.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			throw new Error(
				`Voyage embedding error: ${response.status} ${await response.text()}`,
			);
		}

		const data = (await response.json()) as VoyageEmbeddingResponse;

		if (!Array.isArray(data.data)) {
			throw new Error("Voyage embedding error: invalid response payload");
		}

		if (data.data.some((item) => !isValidEmbeddingItem(item))) {
			throw new Error("Voyage embedding error: invalid response payload");
		}

		if (data.data.length === 0) {
			throw new Error("Voyage embedding error: no embeddings returned");
		}

		return data.data
			.sort((left, right) => left.index - right.index)
			.map((item) => item.embedding);
	}

	return {
		name: "voyage",
		model,
		dimensions,
		rateLimit: { delayMs: 200 },

		async embed(text: string): Promise<number[]> {
			const vectors = await callApi(text);
			return vectors[0];
		},

		async embedMany(texts: string[]): Promise<number[][]> {
			if (texts.length === 0) {
				return [];
			}

			return callApi(texts);
		},
	};
}
