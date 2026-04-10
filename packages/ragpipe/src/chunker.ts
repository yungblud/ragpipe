import type { ChunkerPlugin, DocumentChunk } from "./types.js";

const DEFAULT_CHUNK_SIZE = 400;
const DEFAULT_OVERLAP = 50;

export interface DefaultChunkerOptions {
	chunkSize?: number;
	overlap?: number;
}

/**
 * Splits text into chunks by paragraph boundaries, respecting a max character size.
 * Adjacent chunks overlap by `overlap` characters to preserve context at boundaries.
 */
export function defaultChunker(options?: DefaultChunkerOptions): ChunkerPlugin {
	const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
	const overlap = options?.overlap ?? DEFAULT_OVERLAP;

	function splitLongText(text: string): string[] {
		if (text.length <= chunkSize) return [text];

		const pieces: string[] = [];
		let remaining = text;

		while (remaining.length > chunkSize) {
			let splitAt = remaining.lastIndexOf(". ", chunkSize);
			if (splitAt <= 0) splitAt = remaining.lastIndexOf(" ", chunkSize);
			if (splitAt <= 0) splitAt = chunkSize;
			else splitAt += 1;

			pieces.push(remaining.slice(0, splitAt).trim());
			remaining = remaining.slice(splitAt).trim();
		}

		if (remaining.trim()) pieces.push(remaining.trim());
		return pieces;
	}

	return {
		name: "default",

		chunk(text: string, source: string): DocumentChunk[] {
			const paragraphs = text
				.split(/\n\s*\n/)
				.map((p) => p.trim())
				.filter(Boolean);

			const chunks: DocumentChunk[] = [];
			let current = "";

			for (const paragraph of paragraphs) {
				if (current && current.length + paragraph.length + 1 > chunkSize) {
					for (const piece of splitLongText(current)) {
						chunks.push({ source, content: piece });
					}
					const overlapSlice = current.slice(-overlap);
					current = overlapSlice + paragraph;
				} else {
					current = current ? `${current}\n${paragraph}` : paragraph;
				}
			}

			if (current.trim()) {
				for (const piece of splitLongText(current)) {
					chunks.push({ source, content: piece });
				}
			}

			if (chunks.length === 0 && text.trim()) {
				for (const piece of splitLongText(text.trim())) {
					chunks.push({ source, content: piece });
				}
			}

			return chunks;
		},
	};
}
