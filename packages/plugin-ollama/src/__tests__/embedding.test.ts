import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ollamaEmbedding } from "../embedding.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ollamaEmbedding", () => {
	const plugin = ollamaEmbedding({
		model: "bge-m3",
		dimensions: 1024,
	});

	it("has correct metadata", () => {
		expect(plugin.name).toBe("ollama");
		expect(plugin.dimensions).toBe(1024);
		expect(plugin.model).toBe("bge-m3");
	});

	it("uses custom baseUrl", () => {
		const custom = ollamaEmbedding({
			model: "bge-m3",
			dimensions: 1024,
			baseUrl: "http://gpu-server:11434",
		});
		expect(custom.name).toBe("ollama");
	});

	it("embeds text via /api/embed", async () => {
		const fakeVector = [0.1, 0.2, 0.3];
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ embeddings: [fakeVector] }),
		});

		const result = await plugin.embed("hello world");

		expect(result).toEqual(fakeVector);
		expect(mockFetch).toHaveBeenCalledOnce();

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe("http://localhost:11434/api/embed");
		expect(init.method).toBe("POST");

		const body = JSON.parse(init.body);
		expect(body.model).toBe("bge-m3");
		expect(body.input).toBe("hello world");
	});

	it("batch embeds via embedMany", async () => {
		const vectors = [
			[0.1, 0.2],
			[0.3, 0.4],
		];
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ embeddings: vectors }),
		});

		const result = await plugin.embedMany?.(["text1", "text2"]);

		expect(result).toEqual(vectors);

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.input).toEqual(["text1", "text2"]);
	});

	it("throws on server unreachable", async () => {
		mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

		await expect(plugin.embed("test")).rejects.toThrow(
			'Ollama server not reachable at http://localhost:11434. Run "ollama serve" to start the server.',
		);
	});

	it("throws on model not found (404)", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			text: () => Promise.resolve("model not found"),
		});

		await expect(plugin.embed("test")).rejects.toThrow(
			'Model "bge-m3" not found. Run "ollama pull bge-m3" to download the model.',
		);
	});

	it("throws on HTTP error", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: () => Promise.resolve("Internal Server Error"),
		});

		await expect(plugin.embed("test")).rejects.toThrow(
			"Ollama embedding error: 500 Internal Server Error",
		);
	});
});
