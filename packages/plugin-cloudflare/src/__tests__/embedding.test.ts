import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloudflareEmbedding } from "../embedding.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("cloudflareEmbedding", () => {
	const plugin = cloudflareEmbedding({
		accountId: "test-account",
		apiToken: "test-token",
		model: "@cf/qwen/qwen3-embedding-0.6b",
	});

	it("has correct metadata", () => {
		expect(plugin.name).toBe("cloudflare");
		expect(plugin.dimensions).toBe(768);
		expect(plugin.model).toBe("@cf/qwen/qwen3-embedding-0.6b");
	});

	it("embeds text via Cloudflare API", async () => {
		const fakeVector = [0.1, 0.2, 0.3];
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					result: { data: [fakeVector] },
					success: true,
				}),
		});

		const result = await plugin.embed("hello world");

		expect(result).toEqual(fakeVector);
		expect(mockFetch).toHaveBeenCalledOnce();

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("test-account");
		expect(url).toContain("@cf/qwen/qwen3-embedding-0.6b");
		expect(init.method).toBe("POST");
		expect(init.headers.Authorization).toBe("Bearer test-token");

		const body = JSON.parse(init.body);
		expect(body.text).toEqual(["hello world"]);
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
					result: { data: vectors },
					success: true,
				}),
		});

		const result = await plugin.embedMany?.(["text1", "text2"]);

		expect(result).toEqual(vectors);

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.text).toEqual(["text1", "text2"]);
	});

	it("throws on HTTP error", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: () => Promise.resolve("Unauthorized"),
		});

		await expect(plugin.embed("test")).rejects.toThrow(
			"Cloudflare embedding error: 401 Unauthorized",
		);
	});

	it("throws on success=false", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					result: { data: [] },
					success: false,
				}),
		});

		await expect(plugin.embed("test")).rejects.toThrow(
			"API returned success=false",
		);
	});
});
