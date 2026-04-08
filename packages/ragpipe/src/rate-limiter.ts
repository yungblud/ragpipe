import type { EmbeddingPlugin } from "./types.js";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an EmbeddingPlugin to enforce rate limiting between calls.
 * Uses the plugin's `rateLimit.delayMs` if present, or a custom delay.
 */
export function createRateLimitedEmbedder(
	plugin: EmbeddingPlugin,
	delayMs?: number,
): EmbeddingPlugin {
	const delay = delayMs ?? plugin.rateLimit?.delayMs ?? 0;
	let lastCall = 0;

	async function throttle(): Promise<void> {
		if (delay <= 0) return;
		const now = Date.now();
		const elapsed = now - lastCall;
		if (elapsed < delay) {
			await sleep(delay - elapsed);
		}
		lastCall = Date.now();
	}

	return {
		name: plugin.name,
		dimensions: plugin.dimensions,
		rateLimit: plugin.rateLimit,
		model: plugin.model,

		async embed(text: string): Promise<number[]> {
			await throttle();
			return plugin.embed(text);
		},

		async embedMany(texts: string[]): Promise<number[][]> {
			if (plugin.embedMany) {
				await throttle();
				return plugin.embedMany(texts);
			}
			const results: number[][] = [];
			for (const text of texts) {
				await throttle();
				results.push(await plugin.embed(text));
			}
			return results;
		},
	};
}
