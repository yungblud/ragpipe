import { describe, expect, it } from "vitest";
import { defaultChunker } from "../chunker.js";

describe("defaultChunker", () => {
	it("splits text by paragraph boundaries", () => {
		const chunker = defaultChunker({ chunkSize: 100, overlap: 0 });
		const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
		const chunks = chunker.chunk(text, "test.md");

		expect(chunks.length).toBeGreaterThanOrEqual(1);
		expect(chunks[0].source).toBe("test.md");
		expect(chunks[0].content).toContain("First paragraph.");
	});

	it("respects chunkSize and creates multiple chunks", () => {
		const chunker = defaultChunker({ chunkSize: 30, overlap: 0 });
		const text =
			"Short paragraph A.\n\nShort paragraph B.\n\nShort paragraph C.";
		const chunks = chunker.chunk(text, "doc.md");

		expect(chunks.length).toBeGreaterThan(1);
	});

	it("handles single paragraph within chunkSize", () => {
		const chunker = defaultChunker({ chunkSize: 500, overlap: 0 });
		const text = "Just one paragraph.";
		const chunks = chunker.chunk(text, "single.md");

		expect(chunks).toHaveLength(1);
		expect(chunks[0].content).toBe("Just one paragraph.");
	});

	it("handles empty text", () => {
		const chunker = defaultChunker();
		const chunks = chunker.chunk("", "empty.md");

		expect(chunks).toHaveLength(0);
	});

	it("handles whitespace-only text", () => {
		const chunker = defaultChunker();
		const chunks = chunker.chunk("   \n\n   ", "whitespace.md");

		expect(chunks).toHaveLength(0);
	});

	it("preserves overlap between chunks", () => {
		const chunker = defaultChunker({ chunkSize: 30, overlap: 10 });
		const text =
			"Alpha paragraph one.\n\nBeta paragraph two.\n\nGamma paragraph three.";
		const chunks = chunker.chunk(text, "overlap.md");

		if (chunks.length >= 2) {
			const endOfFirst = chunks[0].content.slice(-10);
			expect(chunks[1].content).toContain(endOfFirst);
		}
	});

	it("uses default chunkSize and overlap when no options given", () => {
		const chunker = defaultChunker();
		expect(chunker.name).toBe("default");

		const longText = Array.from(
			{ length: 50 },
			(_, i) => `Paragraph ${i}.`,
		).join("\n\n");
		const chunks = chunker.chunk(longText, "defaults.md");

		expect(chunks.length).toBeGreaterThan(1);
	});

	it("returns single chunk for text without paragraph breaks", () => {
		const chunker = defaultChunker({ chunkSize: 1000, overlap: 0 });
		const text = "A single block of text without any double newlines at all.";
		const chunks = chunker.chunk(text, "no-breaks.md");

		expect(chunks).toHaveLength(1);
		expect(chunks[0].content).toBe(text);
	});

	it("splits a single long paragraph exceeding chunkSize", () => {
		const chunker = defaultChunker({ chunkSize: 50, overlap: 0 });
		const text =
			"First sentence here. Second sentence here. Third sentence here. Fourth sentence here.";
		const chunks = chunker.chunk(text, "long.md");

		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.content.length).toBeLessThanOrEqual(55);
		}
		const joined = chunks.map((c) => c.content).join(" ");
		expect(joined).toContain("First sentence");
		expect(joined).toContain("Fourth sentence");
	});

	it("splits long text without sentence boundaries by word", () => {
		const chunker = defaultChunker({ chunkSize: 30, overlap: 0 });
		const text = "abcdefgh ijklmnop qrstuvwx yzabcdef ghijklmn opqrstuv";
		const chunks = chunker.chunk(text, "words.md");

		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.content.length).toBeLessThanOrEqual(35);
		}
	});

	it("hard-splits text with no spaces at chunkSize", () => {
		const chunker = defaultChunker({ chunkSize: 20, overlap: 0 });
		const text = "a".repeat(50);
		const chunks = chunker.chunk(text, "nospace.md");

		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.content.length).toBeLessThanOrEqual(20);
		}
	});
});
