import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openaiEmbedding } from "../embedding.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("openaiEmbedding", () => {
	const plugin = openaiEmbedding({
		apiKey: "sk-test-key",
	});

	it("has correct default metadata", () => {
		expect(plugin.name).toBe("openai");
		expect(plugin.dimensions).toBe(1536);
		expect(plugin.model).toBe("text-embedding-3-small");
		expect(plugin.rateLimit).toEqual({ delayMs: 200 });
	});

	it("uses custom model and dimensions", () => {
		const custom = openaiEmbedding({
			apiKey: "sk-test",
			model: "text-embedding-3-large",
		});
		expect(custom.model).toBe("text-embedding-3-large");
		expect(custom.dimensions).toBe(3072);
	});

	it("uses user-specified dimensions override", () => {
		const custom = openaiEmbedding({
			apiKey: "sk-test",
			model: "text-embedding-3-small",
			dimensions: 512,
		});
		expect(custom.dimensions).toBe(512);
	});

	it("embeds text via OpenAI API", async () => {
		const fakeVector = [0.1, 0.2, 0.3];
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					data: [{ embedding: fakeVector, index: 0 }],
				}),
		});

		const result = await plugin.embed("hello world");

		expect(result).toEqual(fakeVector);
		expect(mockFetch).toHaveBeenCalledOnce();

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe("https://api.openai.com/v1/embeddings");
		expect(init.method).toBe("POST");
		expect(init.headers.Authorization).toBe("Bearer sk-test-key");

		const body = JSON.parse(init.body);
		expect(body.model).toBe("text-embedding-3-small");
		expect(body.input).toBe("hello world");
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
					data: [
						{ embedding: vectors[0], index: 0 },
						{ embedding: vectors[1], index: 1 },
					],
				}),
		});

		const result = await plugin.embedMany?.(["text1", "text2"]);

		expect(result).toEqual(vectors);

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.input).toEqual(["text1", "text2"]);
	});

	it("sorts results by index", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					data: [
						{ embedding: [0.3, 0.4], index: 1 },
						{ embedding: [0.1, 0.2], index: 0 },
					],
				}),
		});

		const result = await plugin.embedMany?.(["a", "b"]);

		expect(result).toEqual([
			[0.1, 0.2],
			[0.3, 0.4],
		]);
	});

	it("sends dimensions param for text-embedding-3 models", async () => {
		const custom = openaiEmbedding({
			apiKey: "sk-test",
			model: "text-embedding-3-small",
			dimensions: 256,
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					data: [{ embedding: [0.1], index: 0 }],
				}),
		});

		await custom.embed("test");

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.dimensions).toBe(256);
	});

	it("does not send dimensions param for ada-002", async () => {
		const ada = openaiEmbedding({
			apiKey: "sk-test",
			model: "text-embedding-ada-002",
			dimensions: 1536,
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					data: [{ embedding: [0.1], index: 0 }],
				}),
		});

		await ada.embed("test");

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.dimensions).toBeUndefined();
	});

	it("uses custom baseUrl", async () => {
		const custom = openaiEmbedding({
			apiKey: "sk-test",
			baseUrl: "https://openrouter.ai/api/v1",
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					data: [{ embedding: [0.1], index: 0 }],
				}),
		});

		await custom.embed("test");

		const [url] = mockFetch.mock.calls[0];
		expect(url).toBe("https://openrouter.ai/api/v1/embeddings");
	});

	it("throws on HTTP error", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: () => Promise.resolve("Unauthorized"),
		});

		await expect(plugin.embed("test")).rejects.toThrow(
			"OpenAI embedding error: 401 Unauthorized",
		);
	});
});
