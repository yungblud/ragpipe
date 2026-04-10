import {
	ConverseCommand,
	ConverseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bedrockGeneration } from "../generation.js";

const mockSend = vi.fn();

vi.mock("../client.js", () => ({
	createBedrockRuntimeClient: () => ({ send: mockSend }),
}));

beforeEach(() => {
	mockSend.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

function converseResponse(text: string) {
	return {
		output: {
			message: {
				role: "assistant",
				content: [{ text }],
			},
		},
		stopReason: "end_turn",
		usage: { inputTokens: 10, outputTokens: 5 },
	};
}

async function* streamEvents(chunks: { text?: string; other?: boolean }[]) {
	for (const chunk of chunks) {
		if (chunk.text) {
			yield { contentBlockDelta: { delta: { text: chunk.text } } };
		} else if (chunk.other) {
			yield { messageStart: { role: "assistant" } };
		}
	}
}

describe("bedrockGeneration", () => {
	const plugin = bedrockGeneration({
		region: "us-east-1",
	});

	it("has correct default metadata", () => {
		expect(plugin.name).toBe("bedrock");
		expect(plugin.model).toBe("anthropic.claude-3-5-haiku-20241022-v1:0");
	});

	it("generates text via Converse", async () => {
		mockSend.mockResolvedValueOnce(converseResponse("Generated answer"));

		const result = await plugin.generate("What is X?", "X is a thing.");

		expect(result).toBe("Generated answer");
		expect(mockSend).toHaveBeenCalledOnce();

		const command = mockSend.mock.calls[0][0];
		expect(command).toBeInstanceOf(ConverseCommand);
		expect(command.input.modelId).toBe(
			"anthropic.claude-3-5-haiku-20241022-v1:0",
		);
		expect(command.input.system).toEqual([
			{ text: "Answer based on the provided context." },
		]);
		expect(command.input.messages[0].role).toBe("user");
		expect(command.input.messages[0].content[0].text).toContain("What is X?");
		expect(command.input.messages[0].content[0].text).toContain(
			"X is a thing.",
		);
		expect(command.input.inferenceConfig).toEqual({
			maxTokens: 1024,
			temperature: 0.2,
			topP: 0.9,
		});
	});

	it("uses custom model and systemPrompt", async () => {
		const custom = bedrockGeneration({
			region: "us-east-1",
			model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
			systemPrompt: "Be concise.",
		});
		mockSend.mockResolvedValueOnce(converseResponse("Short."));

		await custom.generate("Q", "C");

		const command = mockSend.mock.calls[0][0];
		expect(command.input.modelId).toBe(
			"anthropic.claude-3-5-sonnet-20241022-v2:0",
		);
		expect(command.input.system).toEqual([{ text: "Be concise." }]);
	});

	it("per-call systemPrompt overrides factory option", async () => {
		const custom = bedrockGeneration({
			region: "us-east-1",
			systemPrompt: "Factory prompt.",
		});
		mockSend.mockResolvedValueOnce(converseResponse("OK"));

		await custom.generate("Q", "C", { systemPrompt: "Per-call prompt." });

		const command = mockSend.mock.calls[0][0];
		expect(command.input.system).toEqual([{ text: "Per-call prompt." }]);
	});

	it("includes conversation history in user prompt", async () => {
		mockSend.mockResolvedValueOnce(converseResponse("OK"));

		await plugin.generate("Q", "C", { history: "prev Q&A" });

		const userText =
			mockSend.mock.calls[0][0].input.messages[0].content[0].text;
		expect(userText).toContain("Conversation history:\nprev Q&A");
		expect(userText).toContain("Context:\nC");
		expect(userText).toContain("Question: Q");
	});

	it("uses custom inferenceConfig", async () => {
		const custom = bedrockGeneration({
			region: "us-east-1",
			maxTokens: 512,
			temperature: 0.8,
			topP: 0.95,
		});
		mockSend.mockResolvedValueOnce(converseResponse("OK"));

		await custom.generate("Q", "C");

		expect(mockSend.mock.calls[0][0].input.inferenceConfig).toEqual({
			maxTokens: 512,
			temperature: 0.8,
			topP: 0.95,
		});
	});

	it("returns empty string when output content is empty", async () => {
		mockSend.mockResolvedValueOnce({
			output: { message: { content: [] } },
			stopReason: "end_turn",
		});

		const result = await plugin.generate("Q", "C");
		expect(result).toBe("");
	});

	it("returns empty string when output is undefined", async () => {
		mockSend.mockResolvedValueOnce({
			output: undefined,
			stopReason: "end_turn",
		});

		const result = await plugin.generate("Q", "C");
		expect(result).toBe("");
	});

	it("throws on unsupported model family", async () => {
		const bad = bedrockGeneration({
			region: "us-east-1",
			model: "meta.llama3-70b-instruct-v1:0",
		});

		await expect(bad.generate("Q", "C")).rejects.toThrow(
			"Unsupported Bedrock generation model: meta.llama3-70b-instruct-v1:0",
		);
	});

	it("propagates SDK errors", async () => {
		mockSend.mockRejectedValueOnce(
			new Error("ThrottlingException: Rate exceeded"),
		);

		await expect(plugin.generate("Q", "C")).rejects.toThrow(
			"ThrottlingException: Rate exceeded",
		);
	});

	describe("generateStream", () => {
		async function collectStream(
			question: string,
			context: string,
			opts?: { history?: string; systemPrompt?: string },
		): Promise<string[]> {
			const stream = plugin.generateStream;
			if (!stream) throw new Error("generateStream not defined");
			const chunks: string[] = [];
			for await (const chunk of stream.call(plugin, question, context, opts)) {
				chunks.push(chunk);
			}
			return chunks;
		}

		it("streams text chunks from ConverseStream", async () => {
			mockSend.mockResolvedValueOnce({
				stream: streamEvents([{ text: "Hello" }, { text: " world" }]),
			});

			const chunks = await collectStream("Q", "C");

			expect(chunks).toEqual(["Hello", " world"]);
			expect(mockSend.mock.calls[0][0]).toBeInstanceOf(ConverseStreamCommand);
		});

		it("skips non-text events", async () => {
			mockSend.mockResolvedValueOnce({
				stream: streamEvents([
					{ other: true },
					{ text: "ok" },
					{ other: true },
					{ text: "fine" },
				]),
			});

			const chunks = await collectStream("Q", "C");
			expect(chunks).toEqual(["ok", "fine"]);
		});

		it("handles empty stream gracefully", async () => {
			mockSend.mockResolvedValueOnce({ stream: undefined });

			const chunks = await collectStream("Q", "C");
			expect(chunks).toEqual([]);
		});

		it("passes correct payload to ConverseStreamCommand", async () => {
			mockSend.mockResolvedValueOnce({
				stream: streamEvents([{ text: "ok" }]),
			});

			await collectStream("Q", "C", { systemPrompt: "Custom." });

			const command = mockSend.mock.calls[0][0];
			expect(command).toBeInstanceOf(ConverseStreamCommand);
			expect(command.input.system).toEqual([{ text: "Custom." }]);
			expect(command.input.inferenceConfig).toEqual({
				maxTokens: 1024,
				temperature: 0.2,
				topP: 0.9,
			});
		});

		it("throws on unsupported model family", async () => {
			const bad = bedrockGeneration({
				region: "us-east-1",
				model: "mistral.mistral-large-2407-v1:0",
			});

			const stream = bad.generateStream;
			if (!stream) throw new Error("generateStream not defined");

			const iter = stream.call(bad, "Q", "C")[Symbol.asyncIterator]();
			await expect(iter.next()).rejects.toThrow(
				"Unsupported Bedrock generation model: mistral.mistral-large-2407-v1:0",
			);
		});
	});
});
