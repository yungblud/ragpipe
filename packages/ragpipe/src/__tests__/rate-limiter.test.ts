import { describe, expect, it, vi } from "vitest";
import { createRateLimitedEmbedder } from "../rate-limiter.js";
import { createMockEmbedding } from "./helpers.js";

describe("createRateLimitedEmbedder", () => {
	it("delegates embed calls to the underlying plugin", async () => {
		const embed = vi.fn().mockResolvedValue([1, 2, 3]);
		const plugin = createMockEmbedding({ embed });
		const limiter = createRateLimitedEmbedder(plugin, 0);

		const result = await limiter.embed("hello");

		expect(embed).toHaveBeenCalledWith("hello");
		expect(result).toEqual([1, 2, 3]);
	});

	it("preserves plugin metadata", () => {
		const plugin = createMockEmbedding({
			name: "test-embed",
			dimensions: 768,
		});
		const limiter = createRateLimitedEmbedder(plugin);

		expect(limiter.name).toBe("test-embed");
		expect(limiter.dimensions).toBe(768);
	});

	it("throttles rapid consecutive calls", async () => {
		const embed = vi.fn().mockResolvedValue([1, 2, 3]);
		const plugin = createMockEmbedding({ embed });
		const limiter = createRateLimitedEmbedder(plugin, 50);

		const start = Date.now();
		await limiter.embed("first");
		await limiter.embed("second");
		const elapsed = Date.now() - start;

		expect(elapsed).toBeGreaterThanOrEqual(40);
		expect(embed).toHaveBeenCalledTimes(2);
	});

	it("uses plugin rateLimit.delayMs when no custom delay", async () => {
		const embed = vi.fn().mockResolvedValue([1]);
		const plugin = createMockEmbedding({
			embed,
			rateLimit: { delayMs: 50 },
		});
		const limiter = createRateLimitedEmbedder(plugin);

		const start = Date.now();
		await limiter.embed("a");
		await limiter.embed("b");
		const elapsed = Date.now() - start;

		expect(elapsed).toBeGreaterThanOrEqual(40);
	});

	it("embedMany delegates to plugin.embedMany when available", async () => {
		const embedMany = vi.fn().mockResolvedValue([[1], [2]]);
		const plugin = createMockEmbedding({ embedMany });
		const limiter = createRateLimitedEmbedder(plugin, 0);

		const results = await limiter.embedMany?.(["a", "b"]);

		expect(embedMany).toHaveBeenCalledWith(["a", "b"]);
		expect(results).toEqual([[1], [2]]);
	});

	it("embedMany falls back to sequential embed when embedMany not available", async () => {
		const embed = vi.fn().mockResolvedValue([1, 2]);
		const plugin = createMockEmbedding({ embed, embedMany: undefined });
		const limiter = createRateLimitedEmbedder(plugin, 0);

		const results = await limiter.embedMany?.(["x", "y", "z"]);

		expect(embed).toHaveBeenCalledTimes(3);
		expect(results).toEqual([
			[1, 2],
			[1, 2],
			[1, 2],
		]);
	});
});
