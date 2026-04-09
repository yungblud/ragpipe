import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiEmbedding } from "../embedding.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("geminiEmbedding", () => {
	const plugin = geminiEmbedding({
		apiKey: "test-key",
		model: "gemini-embedding-001",
		dimensions: 3072,
	});

	it("has correct metadata", () => {
		expect(plugin.name).toBe("gemini");
		expect(plugin.dimensions).toBe(3072);
		expect(plugin.rateLimit).toEqual({ delayMs: 800 });
		expect(plugin.model).toEqual("gemini-embedding-001");
	});

	it("embeds text via Gemini API", async () => {
		const fakeVector = [0.1, 0.2, 0.3];
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ embedding: { values: fakeVector } }),
		});

		const result = await plugin.embed("hello world");

		expect(result).toEqual(fakeVector);
		expect(mockFetch).toHaveBeenCalledOnce();

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("gemini-embedding-001:embedContent");
		expect(url).toContain("key=test-key");
		expect(init.method).toBe("POST");

		const body = JSON.parse(init.body);
		expect(body.content.parts[0].text).toBe("hello world");
	});

	it("uses custom dimensions when provided", () => {
		const custom = geminiEmbedding({
			apiKey: "key",
			model: "gemini-embedding-001",
			dimensions: 256,
		});
		expect(custom.dimensions).toBe(256);
	});

	it("uses custom model", async () => {
		const custom = geminiEmbedding({
			apiKey: "key",
			model: "custom-model",
			dimensions: 3072,
		});
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ embedding: { values: [1] } }),
		});

		await custom.embed("test");

		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("custom-model:embedContent");
	});

	it("throws on API error", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: () => Promise.resolve("Unauthorized"),
		});

		await expect(plugin.embed("test")).rejects.toThrow(
			"Gemini embedding error: 401 Unauthorized",
		);
	});

	it("batch embeds via embedMany", async () => {
		const vectors = [
			[0.1, 0.2],
			[0.3, 0.4],
		];
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					embeddings: vectors.map((values) => ({ values })),
				}),
		});

		const result = await plugin.embedMany?.(["text1", "text2"]);

		expect(result).toEqual(vectors);
		const [url] = mockFetch.mock.calls[0];
		expect(url).toContain("batchEmbedContents");
	});
});
