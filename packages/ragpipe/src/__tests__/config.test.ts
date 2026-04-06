import { describe, expect, it } from "vitest";
import { defineConfig } from "../config.js";
import { createMockConfig } from "./helpers.js";

describe("defineConfig", () => {
	it("returns the config as-is (identity function)", () => {
		const input = createMockConfig();
		const result = defineConfig(input);

		expect(result).toBe(input);
	});

	it("preserves all config properties", () => {
		const input = createMockConfig({ systemPrompt: "Be concise." });
		const result = defineConfig(input);

		expect(result.embedding.name).toBe("mock-embedding");
		expect(result.vectorStore.name).toBe("mock-vectorstore");
		expect(result.generation.name).toBe("mock-generation");
		expect(result.systemPrompt).toBe("Be concise.");
	});
});
