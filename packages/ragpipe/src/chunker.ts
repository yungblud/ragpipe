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
export function defaultChunker(
	options?: DefaultChunkerOptions,
): ChunkerPlugin {
	const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
	const overlap = options?.overlap ?? DEFAULT_OVERLAP;

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
					chunks.push({ source, content: current });
					const overlapSlice = current.slice(-overlap);
					current = overlapSlice + paragraph;
				} else {
					current = current ? `${current}\n${paragraph}` : paragraph;
				}
			}

			if (current.trim()) {
				chunks.push({ source, content: current });
			}

			if (chunks.length === 0 && text.trim()) {
				chunks.push({ source, content: text.trim() });
			}

			return chunks;
		},
	};
}
