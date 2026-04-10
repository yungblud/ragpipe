import type { EmbeddingPlugin } from "ragpipe";

export interface OllamaEmbeddingOptions {
	model: string;
	baseUrl?: string;
	dimensions: number;
}

export function ollamaEmbedding(
	options: OllamaEmbeddingOptions,
): EmbeddingPlugin {
	const { model } = options;
	const baseUrl = options.baseUrl ?? "http://localhost:11434";
	const dimensions = options.dimensions;

	async function callApi(input: string | string[]): Promise<number[][]> {
		let res: Response;
		try {
			res = await fetch(`${baseUrl}/api/embed`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model, input }),
			});
		} catch (error) {
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
				`Ollama embedding error: ${res.status} ${await res.text()}`,
			);
		}

		const data = (await res.json()) as {
			embeddings: number[][];
		};

		return data.embeddings;
	}

	return {
		name: "ollama",
		dimensions,
		model,

		async embed(text: string): Promise<number[]> {
			const vectors = await callApi(text);
			return vectors[0];
		},

		async embedMany(texts: string[]): Promise<number[][]> {
			return callApi(texts);
		},
	};
}
