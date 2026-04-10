import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openaiGeneration } from "../generation.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

function chatResponse(content: string) {
	return {
		id: "chatcmpl-test",
		object: "chat.completion",
		created: 1234567890,
		model: "gpt-4o-mini",
		choices: [
			{
				index: 0,
				message: { role: "assistant", content },
				finish_reason: "stop",
			},
		],
	};
}

describe("openaiGeneration", () => {
	const plugin = openaiGeneration({
		apiKey: "sk-test-key",
	});

	it("has correct default metadata", () => {
		expect(plugin.name).toBe("openai");
		expect(plugin.model).toBe("gpt-4o-mini");
	});

	it("generates text via chat completions", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(chatResponse("Generated answer")),
		});

		const result = await plugin.generate("What is X?", "X is a thing.");

		expect(result).toBe("Generated answer");
		expect(mockFetch).toHaveBeenCalledOnce();

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe("https://api.openai.com/v1/chat/completions");
		expect(init.headers.Authorization).toBe("Bearer sk-test-key");

		const body = JSON.parse(init.body);
		expect(body.model).toBe("gpt-4o-mini");
		expect(body.stream).toBe(false);
		expect(body.messages[0]).toEqual({
			role: "system",
			content: "Answer based on the provided context.",
		});
		expect(body.messages[1].content).toContain("What is X?");
		expect(body.messages[1].content).toContain("X is a thing.");
	});

	it("uses custom model and systemPrompt", async () => {
		const custom = openaiGeneration({
			apiKey: "sk-test",
			model: "gpt-4o",
			systemPrompt: "Be concise.",
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(chatResponse("Short.")),
		});

		await custom.generate("Q", "C");

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.model).toBe("gpt-4o");
		expect(body.messages[0].content).toBe("Be concise.");
	});

	it("passes per-call systemPrompt override", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(chatResponse("OK")),
		});

		await plugin.generate("Q", "C", { systemPrompt: "Override prompt" });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.messages[0].content).toBe("Override prompt");
	});

	it("includes conversation history when provided", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(chatResponse("OK")),
		});

		await plugin.generate("Q", "C", { history: "prev Q&A" });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.messages[1].content).toContain(
			"Conversation history:\nprev Q&A",
		);
	});

	it("uses custom baseUrl", async () => {
		const custom = openaiGeneration({
			apiKey: "sk-test",
			baseUrl: "https://openrouter.ai/api/v1",
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve(chatResponse("OK")),
		});

		await custom.generate("Q", "C");

		const [url] = mockFetch.mock.calls[0];
		expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
	});

	it("throws on HTTP error", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: () => Promise.resolve("Server Error"),
		});

		await expect(plugin.generate("Q", "C")).rejects.toThrow(
			"OpenAI generation error: 500 Server Error",
		);
	});

	it("returns empty string when choices are empty", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					id: "chatcmpl-test",
					object: "chat.completion",
					created: 1234567890,
					model: "gpt-4o-mini",
					choices: [],
				}),
		});

		const result = await plugin.generate("Q", "C");
		expect(result).toBe("");
	});

	describe("generateStream", () => {
		function createSSEStream(chunks: string[]) {
			const encoder = new TextEncoder();
			let index = 0;
			return {
				getReader: () => ({
					read: async () => {
						if (index >= chunks.length) return { done: true, value: undefined };
						return { done: false, value: encoder.encode(chunks[index++]) };
					},
					releaseLock: () => {},
				}),
			};
		}

		async function collectStream(
			question: string,
			context: string,
		): Promise<string[]> {
			const stream = plugin.generateStream;
			if (!stream) throw new Error("generateStream not defined");
			const chunks: string[] = [];
			for await (const chunk of stream.call(plugin, question, context)) {
				chunks.push(chunk);
			}
			return chunks;
		}

		it("streams SSE chunks", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: createSSEStream([
					'data: {"choices":[{"delta":{"content":"Hello"}}]}\ndata: {"choices":[{"delta":{"content":" world"}}]}\n',
					"data: [DONE]\n",
				]),
			});

			const chunks = await collectStream("Q", "C");

			expect(chunks).toEqual(["Hello", " world"]);

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.stream).toBe(true);
		});

		it("handles buffered partial lines", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: createSSEStream([
					'data: {"choices":[{"delta":{"content":"part',
					'1"}}]}\ndata: {"choices":[{"delta":{"content":"part2"}}]}\n',
					"data: [DONE]\n",
				]),
			});

			const chunks = await collectStream("Q", "C");

			expect(chunks).toEqual(["part1", "part2"]);
		});

		it("skips malformed JSON chunks", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: createSSEStream([
					'data: {"choices":[{"delta":{"content":"ok"}}]}\ndata: {broken\ndata: {"choices":[{"delta":{"content":"fine"}}]}\n',
					"data: [DONE]\n",
				]),
			});

			const chunks = await collectStream("Q", "C");

			expect(chunks).toEqual(["ok", "fine"]);
		});

		it("throws on HTTP error", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 502,
				text: () => Promise.resolve("Bad Gateway"),
			});

			await expect(collectStream("Q", "C")).rejects.toThrow(
				"OpenAI generation stream error: 502 Bad Gateway",
			);
		});

		it("throws when response body is missing", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				body: null,
			});

			await expect(collectStream("Q", "C")).rejects.toThrow("No response body");
		});
	});
});
