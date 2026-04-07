import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiGeneration } from "../generation.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("geminiGeneration", () => {
	const plugin = geminiGeneration({ apiKey: "test-key" });

	it("has correct metadata", () => {
		expect(plugin.name).toBe("gemini");
	});

	it("generates text via Gemini API", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					candidates: [{ content: { parts: [{ text: "Generated answer" }] } }],
				}),
		});

		const result = await plugin.generate("What is X?", "X is a thing.");

		expect(result).toBe("Generated answer");
		expect(mockFetch).toHaveBeenCalledOnce();

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("gemini-2.5-flash:generateContent");
		expect(url).toContain("key=test-key");

		const body = JSON.parse(init.body);
		expect(body.contents[0].parts[0].text).toContain("What is X?");
		expect(body.contents[0].parts[0].text).toContain("X is a thing.");
		expect(body.systemInstruction.parts[0].text).toBe(
			"Answer based on the provided context.",
		);
	});

	it("uses custom model and systemPrompt", async () => {
		const custom = geminiGeneration({
			apiKey: "key",
			model: "gemini-pro",
			systemPrompt: "Be concise.",
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					candidates: [{ content: { parts: [{ text: "Short." }] } }],
				}),
		});

		await custom.generate("Q", "C");

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toContain("gemini-pro:generateContent");

		const body = JSON.parse(init.body);
		expect(body.systemInstruction.parts[0].text).toBe("Be concise.");
	});

	it("passes per-call systemPrompt override", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					candidates: [{ content: { parts: [{ text: "OK" }] } }],
				}),
		});

		await plugin.generate("Q", "C", { systemPrompt: "Override prompt" });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.systemInstruction.parts[0].text).toBe("Override prompt");
	});

	it("includes conversation history when provided", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					candidates: [{ content: { parts: [{ text: "OK" }] } }],
				}),
		});

		await plugin.generate("Q", "C", { history: "prev Q&A" });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.contents[0].parts[0].text).toContain(
			"Conversation history:\nprev Q&A",
		);
	});

	it("throws on API error", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: () => Promise.resolve("Server Error"),
		});

		await expect(plugin.generate("Q", "C")).rejects.toThrow(
			"Gemini generation error: 500 Server Error",
		);
	});
});
