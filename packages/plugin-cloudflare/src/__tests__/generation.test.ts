import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloudflareGeneration } from "../generation.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("cloudflareGeneration", () => {
	const plugin = cloudflareGeneration({
		accountId: "test-account",
		apiToken: "test-token",
		model: "@cf/meta/llama-3.1-8b-instruct",
	});

	it("has correct metadata", () => {
		expect(plugin.name).toBe("cloudflare");
		expect(plugin.model).toBe("@cf/meta/llama-3.1-8b-instruct");
	});

	it("generates text via Cloudflare API", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					result: { response: "Generated answer" },
					success: true,
				}),
		});

		const result = await plugin.generate("What is X?", "X is a thing.");

		expect(result).toBe("Generated answer");
		expect(mockFetch).toHaveBeenCalledOnce();

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("test-account");
		expect(url).toContain("@cf/meta/llama-3.1-8b-instruct");
		expect(init.headers.Authorization).toBe("Bearer test-token");

		const body = JSON.parse(init.body);
		expect(body.stream).toBe(false);
		expect(body.messages[0]).toEqual({
			role: "system",
			content: "Answer based on the provided context.",
		});
		expect(body.messages[1].content).toContain("What is X?");
		expect(body.messages[1].content).toContain("X is a thing.");
	});

	it("uses custom model and systemPrompt", async () => {
		const custom = cloudflareGeneration({
			accountId: "acc",
			apiToken: "tok",
			model: "@cf/mistral/mistral-7b-instruct-v0.1",
			systemPrompt: "Be concise.",
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					result: { response: "Short." },
					success: true,
				}),
		});

		await custom.generate("Q", "C");

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("mistral-7b-instruct-v0.1");

		const body = JSON.parse(init.body);
		expect(body.messages[0].content).toBe("Be concise.");
	});

	it("passes per-call systemPrompt override", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					result: { response: "OK" },
					success: true,
				}),
		});

		await plugin.generate("Q", "C", { systemPrompt: "Override prompt" });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.messages[0].content).toBe("Override prompt");
	});

	it("includes conversation history when provided", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					result: { response: "OK" },
					success: true,
				}),
		});

		await plugin.generate("Q", "C", { history: "prev Q&A" });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.messages[1].content).toContain(
			"Conversation history:\nprev Q&A",
		);
	});

	it("throws on HTTP error", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: () => Promise.resolve("Server Error"),
		});

		await expect(plugin.generate("Q", "C")).rejects.toThrow(
			"Cloudflare generation error: 500 Server Error",
		);
	});

	it("throws on success=false", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					result: { response: "" },
					success: false,
				}),
		});

		await expect(plugin.generate("Q", "C")).rejects.toThrow(
			"API returned success=false",
		);
	});
});
