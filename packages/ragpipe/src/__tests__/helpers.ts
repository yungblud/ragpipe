import type {
	EmbeddingPlugin,
	GenerationPlugin,
	RagpipeConfig,
	SearchResult,
	VectorStorePlugin,
} from "../types.js";

export function createMockEmbedding(
	overrides?: Partial<EmbeddingPlugin>,
): EmbeddingPlugin {
	return {
		name: "mock-embedding",
		dimensions: 3,
		async embed(_text: string) {
			return [0.1, 0.2, 0.3];
		},
		model: "mock-model",
		...overrides,
	};
}

export function createMockVectorStore(
	overrides?: Partial<VectorStorePlugin>,
): VectorStorePlugin {
	const store: { source: string; content: string; vector: number[] }[] = [];

	return {
		name: "mock-vectorstore",
		async search(_vector: number[], topK: number): Promise<SearchResult[]> {
			return store.slice(0, topK).map((item, i) => ({
				source: item.source,
				content: item.content,
				score: 1 - i * 0.1,
			}));
		},
		async upsert(source: string, content: string, vector: number[]) {
			store.push({ source, content, vector });
		},
		async clear() {
			store.length = 0;
		},
		...overrides,
	};
}

export function createMockGeneration(
	overrides?: Partial<GenerationPlugin>,
): GenerationPlugin {
	return {
		name: "mock-generation",
		model: "mock-model",
		async generate(question: string, _context: string) {
			return `Answer to: ${question}`;
		},
		...overrides,
	};
}

export function createMockConfig(
	overrides?: Partial<RagpipeConfig>,
): RagpipeConfig {
	return {
		embedding: createMockEmbedding(),
		vectorStore: createMockVectorStore(),
		generation: createMockGeneration(),
		...overrides,
	};
}
