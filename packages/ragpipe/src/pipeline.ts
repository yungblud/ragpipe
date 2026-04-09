import consola from "consola";
import { defaultChunker } from "./chunker.js";
import { createRateLimitedEmbedder } from "./rate-limiter.js";
import type { AskResult, RagpipeConfig, SearchResult } from "./types.js";

export interface Pipeline {
	ingest(text: string, source: string): Promise<number>;
	search(query: string, topK?: number): Promise<SearchResult[]>;
	ask(query: string, topK?: number): Promise<AskResult>;
}

export function createPipeline(config: RagpipeConfig): Pipeline {
	const chunker = config.chunker ?? defaultChunker();
	const embedder = config.embedding.rateLimit
		? createRateLimitedEmbedder(config.embedding)
		: config.embedding;

	return {
		async ingest(text: string, source: string): Promise<number> {
			if (config.vectorStore.isReady && config.vectorStore.setup) {
				const ready = await config.vectorStore.isReady();
				if (!ready) {
					consola.info("Vector store not ready. Running setup...");
					await config.vectorStore.setup(config.embedding.dimensions);
				}
			}

			const chunks = chunker.chunk(text, source);
			for (const chunk of chunks) {
				const vector = await embedder.embed(chunk.content);
				await config.vectorStore.upsert(chunk.source, chunk.content, vector);
			}
			return chunks.length;
		},

		async search(query: string, topK = 5): Promise<SearchResult[]> {
			const vector = await embedder.embed(query);
			return config.vectorStore.search(vector, topK);
		},

		async ask(query: string, topK = 5): Promise<AskResult> {
			const chunks = await this.search(query, topK);
			const context = chunks
				.map((c) => `[${c.source}]\n${c.content}`)
				.join("\n\n---\n\n");
			const answer = await config.generation.generate(query, context, {
				systemPrompt: config.systemPrompt,
			});
			return { answer, sources: chunks };
		},
	};
}
