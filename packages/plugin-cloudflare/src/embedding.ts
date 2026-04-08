import type { EmbeddingPlugin } from "ragpipe";

export interface CloudflareEmbeddingOptions {
	accountId: string;
	apiToken: string;
	model?: string;
}

const DIMENSION_MAP: Record<string, number> = {
	"@cf/baai/bge-base-en-v1.5": 768,
	"@cf/baai/bge-large-en-v1.5": 1024,
	"@cf/baai/bge-small-en-v1.5": 384,
};

const DEFAULT_MODEL = "@cf/baai/bge-base-en-v1.5";

export function cloudflareEmbedding(
	options: CloudflareEmbeddingOptions,
): EmbeddingPlugin {
	const model = options.model ?? DEFAULT_MODEL;
	const dimensions = DIMENSION_MAP[model] ?? 768;
	const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/run/${model}`;

	async function callApi(text: string[]): Promise<number[][]> {
		const res = await fetch(baseUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${options.apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ text }),
		});

		if (!res.ok) {
			throw new Error(
				`Cloudflare embedding error: ${res.status} ${await res.text()}`,
			);
		}

		const data = (await res.json()) as {
			result: { data: number[][] };
			success: boolean;
		};

		if (!data.success) {
			throw new Error("Cloudflare embedding error: API returned success=false");
		}

		return data.result.data;
	}

	return {
		name: "cloudflare",
		dimensions,

		async embed(text: string): Promise<number[]> {
			const vectors = await callApi([text]);
			return vectors[0];
		},

		async embedMany(texts: string[]): Promise<number[][]> {
			return callApi(texts);
		},
	};
}
