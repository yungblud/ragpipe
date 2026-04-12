import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { voyageEmbedding } from "../embedding.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("voyageEmbedding", () => {
	const plugin = voyageEmbedding({
		apiKey: "voyage-test-key",
		model: "voyage-4-lite",
		dimensions: 1024,
	});

	it("has correct metadata", () => {
		expect(plugin.name).toBe("voyage");
		expect(plugin.model).toBe("voyage-4-lite");
		expect(plugin.dimensions).toBe(1024);
		expect(plugin.rateLimit).toEqual({ delayMs: 200 });
	});

	it("uses explicit model and dimensions", () => {
		const custom = voyageEmbedding({
			apiKey: "voyage-test-key",
			model: "voyage-code-2",
			dimensions: 1536,
		});

		expect(custom.model).toBe("voyage-code-2");
		expect(custom.dimensions).toBe(1536);
	});

	it("uses user-specified dimensions override", () => {
		const custom = voyageEmbedding({
			apiKey: "voyage-test-key",
			model: "voyage-4-lite",
			dimensions: 512,
		});

		expect(custom.dimensions).toBe(512);
	});

	it("embeds text via Voyage API", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					data: [{ embedding: [0.1, 0.2], index: 0 }],
				}),
		});

		const result = await plugin.embed("hello world");

		expect(result).toEqual([0.1, 0.2]);

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe("https://api.voyageai.com/v1/embeddings");
		expect(init.method).toBe("POST");
		expect(init.headers.Authorization).toBe("Bearer voyage-test-key");

		const body = JSON.parse(init.body);
		expect(body.model).toBe("voyage-4-lite");
		expect(body.input).toBe("hello world");
		expect(body.output_dimension).toBe(1024);
	});

	it("batch embeds via embedMany", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					data: [
						{ embedding: [0.1, 0.2], index: 0 },
						{ embedding: [0.3, 0.4], index: 1 },
					],
				}),
		});

		const result = await plugin.embedMany?.(["text1", "text2"]);

		expect(result).toEqual([
			[0.1, 0.2],
			[0.3, 0.4],
		]);

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

	it("includes output_dimension when dimensions are provided", async () => {
		const custom = voyageEmbedding({
			apiKey: "voyage-test-key",
			model: "voyage-4-lite",
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
		expect(body.output_dimension).toBe(256);
	});

	it("includes input_type when provided", async () => {
		const custom = voyageEmbedding({
			apiKey: "voyage-test-key",
			model: "voyage-4-lite",
			dimensions: 1024,
			inputType: "document",
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
		expect(body.input_type).toBe("document");
	});

	it("uses custom baseUrl", async () => {
		const custom = voyageEmbedding({
			apiKey: "voyage-test-key",
			model: "voyage-4-lite",
			dimensions: 1024,
			baseUrl: "https://proxy.example.com/v1",
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
		expect(url).toBe("https://proxy.example.com/v1/embeddings");
	});

	it("returns [] for embedMany([]) without calling fetch", async () => {
		await expect(plugin.embedMany?.([])).resolves.toEqual([]);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("throws on HTTP error", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: () => Promise.resolve("Unauthorized"),
		});

		await expect(plugin.embed("test")).rejects.toThrow(
			"Voyage embedding error: 401 Unauthorized",
		);
	});

	it("throws on invalid response payload", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: [{ index: "0", embedding: [0.1] }] }),
		});

		await expect(plugin.embed("test")).rejects.toThrow(
			"Voyage embedding error: invalid response payload",
		);
	});

	it("throws when no embeddings are returned", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: [] }),
		});

		await expect(plugin.embed("test")).rejects.toThrow(
			"Voyage embedding error: no embeddings returned",
		);
	});
});
