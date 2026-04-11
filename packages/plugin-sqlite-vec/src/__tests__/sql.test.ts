import { describe, expect, it } from "vitest";
import {
	cosineSimilarity,
	createContentHash,
	formatVector,
	generateDocumentsExistsSQL,
	generateMetadataExistsSQL,
	generateRecreateSQL,
	generateSetupSQL,
	parseVector,
	parseVectorDimension,
	validateIdentifier,
} from "../sql.js";

describe("sqlite sql helpers", () => {
	it("validates identifiers", () => {
		expect(validateIdentifier("documents")).toBe("documents");
		expect(() => validateIdentifier("bad-name")).toThrow(
			'Invalid SQL identifier: "bad-name"',
		);
	});

	it("formats and parses vectors", () => {
		expect(formatVector([1, 2, 3])).toBe("[1,2,3]");
		expect(parseVector("[1,2,3]")).toEqual([1, 2, 3]);
		expect(parseVectorDimension("[1,2,3]")).toBe(3);
	});

	it("rejects invalid vectors", () => {
		expect(() => formatVector([])).toThrow("Vector must not be empty.");
		expect(() => parseVector('{"x":1}')).toThrow(
			"Stored vector must be a JSON array.",
		);
		expect(() => parseVector("[1,null]")).toThrow(
			"Stored vector must contain only finite numbers.",
		);
	});

	it("creates stable content hashes", () => {
		expect(createContentHash("hello")).toBe(createContentHash("hello"));
		expect(createContentHash("hello")).not.toBe(createContentHash("world"));
	});

	it("computes cosine similarity", () => {
		expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
		expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
		expect(() => cosineSimilarity([1], [1, 2])).toThrow(
			"Vector dimension mismatch: query has 1, row has 2.",
		);
	});

	it("generates setup and recreate SQL", () => {
		expect(generateSetupSQL("documents", "ragpipe_meta")).toContain(
			"CREATE TABLE IF NOT EXISTS documents",
		);
		expect(generateSetupSQL("documents", "ragpipe_meta")).toContain(
			"CREATE TABLE IF NOT EXISTS ragpipe_meta",
		);
		expect(generateRecreateSQL("documents", "ragpipe_meta")).toContain(
			"DROP TABLE IF EXISTS documents",
		);
		expect(generateDocumentsExistsSQL("documents")).toContain(
			"name = 'documents'",
		);
		expect(generateMetadataExistsSQL("ragpipe_meta")).toContain(
			"name = 'ragpipe_meta'",
		);
	});
});
