import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ollamaGeneration } from "../generation.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

function chatResponse(content: string, done = true) {
	return {
		model: "llama3",
		message: { role: "assistant", content },
		done,
	};
}

describe("ollamaGeneration", () => {
	const plugin = ollamaGeneration({ model: "llama3" });

	it("has correct metadata", () => {
		expect(plugin.name).toBe("ollama");
		expect(plugin.model).toBe("llama3");
	});

	it("generates text via /api/chat", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve(chatResponse("Generated answer")),
		});

		const result = await plugin.generate("What is X?", "X is a thing.");

		expect(result).toBe("Generated answer");
		expect(mockFetch).toHaveBeenCalledOnce();

		const [url, init] = mockFetch.mock.calls[0];
		expect(url).toBe("http://localhost:11434/api/chat");
		expect(init.method).toBe("POST");

		const body = JSON.parse(init.body);
		expect(body.model).toBe("llama3");
		expect(body.stream).toBe(false);
		expect(body.messages[0]).toEqual({
			role: "system",
			content: "Answer based on the provided context.",
		});
		expect(body.messages[1].content).toContain("What is X?");
		expect(body.messages[1].content).toContain("X is a thing.");
	});

	it("uses custom systemPrompt", async () => {
		const custom = ollamaGeneration({
			model: "mistral",
			systemPrompt: "Be concise.",
		});

		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve(chatResponse("Short.")),
		});

		await custom.generate("Q", "C");

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.messages[0].content).toBe("Be concise.");
	});

	it("passes per-call systemPrompt override", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve(chatResponse("OK")),
		});

		await plugin.generate("Q", "C", { systemPrompt: "Override prompt" });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.messages[0].content).toBe("Override prompt");
	});

	it("includes conversation history when provided", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve(chatResponse("OK")),
		});

		await plugin.generate("Q", "C", { history: "prev Q&A" });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.messages[1].content).toContain(
			"Conversation history:\nprev Q&A",
		);
	});

	it("throws on server unreachable", async () => {
		mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

		await expect(plugin.generate("Q", "C")).rejects.toThrow(
			'Ollama server not reachable at http://localhost:11434. Run "ollama serve" to start the server.',
		);
	});

	it("throws on model not found (404)", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			text: () => Promise.resolve("model not found"),
		});

		await expect(plugin.generate("Q", "C")).rejects.toThrow(
			'Model "llama3" not found. Run "ollama pull llama3" to download the model.',
		);
	});

	it("throws on HTTP error", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			text: () => Promise.resolve("Server Error"),
		});

		await expect(plugin.generate("Q", "C")).rejects.toThrow(
			"Ollama generation error: 500 Server Error",
		);
	});

	describe("generateStream", () => {
		function createNDJSONStream(chunks: string[]) {
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

		it("streams NDJSON chunks", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				body: createNDJSONStream([
					'{"model":"llama3","message":{"role":"assistant","content":"Hello"},"done":false}\n{"model":"llama3","message":{"role":"assistant","content":" world"},"done":false}\n',
					'{"model":"llama3","message":{"role":"assistant","content":""},"done":true}\n',
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
				status: 200,
				body: createNDJSONStream([
					'{"model":"llama3","message":{"role":"assistant","content":"part',
					'1"},"done":false}\n{"model":"llama3","message":{"role":"assistant","content":"part2"},"done":false}\n',
					'{"model":"llama3","message":{"role":"assistant","content":""},"done":true}\n',
				]),
			});

			const chunks = await collectStream("Q", "C");

			expect(chunks).toEqual(["part1", "part2"]);
		});

		it("throws on HTTP error", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 502,
				text: () => Promise.resolve("Bad Gateway"),
			});

			await expect(collectStream("Q", "C")).rejects.toThrow(
				"Ollama generation error: 502 Bad Gateway",
			);
		});

		it("throws when response body is missing", async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				body: null,
			});

			await expect(collectStream("Q", "C")).rejects.toThrow("No response body");
		});
	});

	it("returns empty string when message content is missing", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () =>
				Promise.resolve({
					model: "llama3",
					message: null,
					done: true,
				}),
		});

		const result = await plugin.generate("Q", "C");
		expect(result).toBe("");
	});
});
