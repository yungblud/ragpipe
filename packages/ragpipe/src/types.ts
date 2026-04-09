export interface SearchResult {
	source: string;
	content: string;
	score: number;
}

export interface DocumentChunk {
	source: string;
	content: string;
}

export interface AskResult {
	answer: string;
	sources: SearchResult[];
}

export interface EmbeddingPlugin {
	readonly name: string;
	readonly dimensions: number;
	readonly model: string;
	embed(text: string): Promise<number[]>;
	embedMany?(texts: string[]): Promise<number[][]>;
	rateLimit?: { delayMs: number };
}

export interface VectorStorePlugin {
	readonly name: string;
	search(vector: number[], topK: number): Promise<SearchResult[]>;
	upsert(source: string, content: string, vector: number[]): Promise<void>;
	clear?(): Promise<void>;
	disconnect?(): Promise<void>;
	setup?(dimensions: number, options?: { force?: boolean }): Promise<void>;
	isReady?(): Promise<boolean>;
}

export interface GenerationPlugin {
	readonly name: string;
	readonly model: string;
	generate(
		question: string,
		context: string,
		options?: { history?: string; systemPrompt?: string },
	): Promise<string>;
	generateStream?(
		question: string,
		context: string,
		options?: { history?: string; systemPrompt?: string },
	): AsyncIterable<string>;
}

export interface ChunkerPlugin {
	readonly name: string;
	chunk(text: string, source: string): DocumentChunk[];
}

export interface RagpipeConfig {
	embedding: EmbeddingPlugin;
	vectorStore: VectorStorePlugin;
	generation: GenerationPlugin;
	chunker?: ChunkerPlugin;
	systemPrompt?: string;
}
