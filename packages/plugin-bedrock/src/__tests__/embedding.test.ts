import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bedrockEmbedding } from "../embedding.js";

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

function titanResponse(embedding: number[]) {
	const payload = JSON.stringify({ embedding, inputTextTokenCount: 2 });
	return { body: new TextEncoder().encode(payload) };
}

describe("bedrockEmbedding", () => {
	const plugin = bedrockEmbedding({
		region: "us-east-1",
	});

	it("has correct default metadata", () => {
		expect(plugin.name).toBe("bedrock");
		expect(plugin.model).toBe("amazon.titan-embed-text-v2:0");
		expect(plugin.dimensions).toBe(1024);
		expect(plugin.rateLimit).toEqual({ delayMs: 250 });
	});

	it("uses custom model and dimensions", () => {
		const custom = bedrockEmbedding({
			region: "us-east-1",
			model: "amazon.titan-embed-text-v1",
		});
		expect(custom.model).toBe("amazon.titan-embed-text-v1");
		expect(custom.dimensions).toBe(1536);
	});

	it("uses explicit dimensions override", () => {
		const custom = bedrockEmbedding({
			region: "us-east-1",
			dimensions: 256,
		});
		expect(custom.dimensions).toBe(256);
	});

	it("embeds text via InvokeModel", async () => {
		const fakeVector = [0.1, 0.2, 0.3];
		mockSend.mockResolvedValueOnce(titanResponse(fakeVector));

		const result = await plugin.embed("hello world");

		expect(result).toEqual(fakeVector);
		expect(mockSend).toHaveBeenCalledOnce();

		const command = mockSend.mock.calls[0][0];
		expect(command).toBeInstanceOf(InvokeModelCommand);
		expect(command.input.modelId).toBe("amazon.titan-embed-text-v2:0");
		expect(command.input.contentType).toBe("application/json");

		const body = JSON.parse(command.input.body);
		expect(body.inputText).toBe("hello world");
		expect(body.dimensions).toBe(1024);
		expect(body.normalize).toBe(true);
	});

	it("sends dimensions and normalize for Titan v2 only", async () => {
		const v1Plugin = bedrockEmbedding({
			region: "us-east-1",
			model: "amazon.titan-embed-text-v1",
		});
		mockSend.mockResolvedValueOnce(titanResponse([0.1]));

		await v1Plugin.embed("test");

		const body = JSON.parse(mockSend.mock.calls[0][0].input.body);
		expect(body.inputText).toBe("test");
		expect(body.dimensions).toBeUndefined();
		expect(body.normalize).toBeUndefined();
	});

	it("respects normalize: false option", async () => {
		const custom = bedrockEmbedding({
			region: "us-east-1",
			normalize: false,
		});
		mockSend.mockResolvedValueOnce(titanResponse([0.1]));

		await custom.embed("test");

		const body = JSON.parse(mockSend.mock.calls[0][0].input.body);
		expect(body.normalize).toBe(false);
	});

	it("batch embeds via embedMany preserving order", async () => {
		const vectors = [
			[0.1, 0.2],
			[0.3, 0.4],
			[0.5, 0.6],
		];
		for (const v of vectors) {
			mockSend.mockResolvedValueOnce(titanResponse(v));
		}

		const result = await plugin.embedMany?.(["a", "b", "c"]);

		expect(result).toEqual(vectors);
		expect(mockSend).toHaveBeenCalledTimes(3);

		expect(JSON.parse(mockSend.mock.calls[0][0].input.body).inputText).toBe(
			"a",
		);
		expect(JSON.parse(mockSend.mock.calls[1][0].input.body).inputText).toBe(
			"b",
		);
		expect(JSON.parse(mockSend.mock.calls[2][0].input.body).inputText).toBe(
			"c",
		);
	});

	it("throws on unsupported model family", async () => {
		const bad = bedrockEmbedding({
			region: "us-east-1",
			model: "cohere.embed-english-v3",
		});

		await expect(bad.embed("test")).rejects.toThrow(
			"Unsupported Bedrock embedding model: cohere.embed-english-v3",
		);
	});

	it("propagates SDK errors", async () => {
		mockSend.mockRejectedValueOnce(new Error("AccessDeniedException"));

		await expect(plugin.embed("test")).rejects.toThrow("AccessDeniedException");
	});
});
