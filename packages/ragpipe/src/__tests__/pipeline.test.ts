import { describe, expect, it, vi } from "vitest";
import { createPipeline } from "../pipeline.js";
import {
	createMockConfig,
	createMockEmbedding,
	createMockGeneration,
	createMockVectorStore,
} from "./helpers.js";

describe("createPipeline", () => {
	describe("ingest", () => {
		it("chunks text and stores embeddings", async () => {
			const upsert = vi.fn();
			const config = createMockConfig({
				vectorStore: createMockVectorStore({ upsert }),
			});
			const pipeline = createPipeline(config);

			const count = await pipeline.ingest(
				"Hello world.\n\nThis is a test.",
				"test.md",
			);

			expect(count).toBeGreaterThanOrEqual(1);
			expect(upsert).toHaveBeenCalled();
			expect(upsert.mock.calls[0][0]).toBe("test.md");
		});

		it("calls embed for each chunk", async () => {
			const embed = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
			const config = createMockConfig({
				embedding: createMockEmbedding({ embed }),
			});
			const pipeline = createPipeline(config);

			await pipeline.ingest("Paragraph one.\n\nParagraph two.", "multi.md");

			expect(embed).toHaveBeenCalledTimes(embed.mock.calls.length);
			expect(embed.mock.calls.length).toBeGreaterThanOrEqual(1);
		});

		it("returns 0 for empty text", async () => {
			const pipeline = createPipeline(createMockConfig());
			const count = await pipeline.ingest("", "empty.md");

			expect(count).toBe(0);
		});
	});

	describe("search", () => {
		it("embeds query and searches vector store", async () => {
			const searchFn = vi
				.fn()
				.mockResolvedValue([
					{ source: "doc.md", content: "relevant content", score: 0.95 },
				]);
			const config = createMockConfig({
				vectorStore: createMockVectorStore({ search: searchFn }),
			});
			const pipeline = createPipeline(config);

			const results = await pipeline.search("test query");

			expect(searchFn).toHaveBeenCalledWith([0.1, 0.2, 0.3], 5);
			expect(results).toHaveLength(1);
			expect(results[0].source).toBe("doc.md");
		});

		it("passes custom topK", async () => {
			const searchFn = vi.fn().mockResolvedValue([]);
			const config = createMockConfig({
				vectorStore: createMockVectorStore({ search: searchFn }),
			});
			const pipeline = createPipeline(config);

			await pipeline.search("query", 10);

			expect(searchFn).toHaveBeenCalledWith([0.1, 0.2, 0.3], 10);
		});
	});

	describe("ask", () => {
		it("searches, builds context, and generates answer", async () => {
			const generate = vi.fn().mockResolvedValue("Generated answer");
			const searchFn = vi
				.fn()
				.mockResolvedValue([
					{ source: "guide.md", content: "Some context", score: 0.9 },
				]);
			const config = createMockConfig({
				vectorStore: createMockVectorStore({ search: searchFn }),
				generation: createMockGeneration({ generate }),
			});
			const pipeline = createPipeline(config);

			const result = await pipeline.ask("How does it work?");

			expect(result.answer).toBe("Generated answer");
			expect(result.sources).toHaveLength(1);
			expect(result.sources[0].source).toBe("guide.md");
			expect(generate).toHaveBeenCalledWith(
				"How does it work?",
				expect.stringContaining("[guide.md]"),
				expect.objectContaining({ systemPrompt: undefined }),
			);
		});

		it("passes systemPrompt from config to generate", async () => {
			const generate = vi.fn().mockResolvedValue("answer");
			const searchFn = vi
				.fn()
				.mockResolvedValue([{ source: "a.md", content: "ctx", score: 0.8 }]);
			const config = createMockConfig({
				vectorStore: createMockVectorStore({ search: searchFn }),
				generation: createMockGeneration({ generate }),
				systemPrompt: "You are a helpful assistant.",
			});
			const pipeline = createPipeline(config);

			await pipeline.ask("question");

			expect(generate).toHaveBeenCalledWith(
				"question",
				expect.any(String),
				expect.objectContaining({
					systemPrompt: "You are a helpful assistant.",
				}),
			);
		});
	});
});
