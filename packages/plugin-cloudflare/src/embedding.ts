import type { EmbeddingPlugin } from "ragpipe";

export interface CloudflareEmbeddingOptions {
	accountId: string;
	apiToken: string;
	model: string;
	dimensions?: number;
}

export function cloudflareEmbedding(
	options: CloudflareEmbeddingOptions,
): EmbeddingPlugin {
	const { model } = options;
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
		dimensions: options.dimensions ?? 768,
		model,

		async embed(text: string): Promise<number[]> {
			const vectors = await callApi([text]);
			return vectors[0];
		},

		async embedMany(texts: string[]): Promise<number[][]> {
			return callApi(texts);
		},
	};
}
