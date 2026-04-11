import { describe, expect, it } from "vitest";
import {
	generateRecreateSQL,
	generateSetupSQL,
	parseVectorDimension,
	validateIdentifier,
} from "../sql.js";

describe("validateIdentifier", () => {
	it("accepts valid identifiers", () => {
		expect(validateIdentifier("documents")).toBe("documents");
		expect(validateIdentifier("rag_data")).toBe("rag_data");
		expect(validateIdentifier("_private")).toBe("_private");
	});

	it("rejects invalid identifiers", () => {
		expect(() => validateIdentifier("drop; --")).toThrow(
			"Invalid SQL identifier",
		);
		expect(() => validateIdentifier("my-table")).toThrow(
			"Invalid SQL identifier",
		);
		expect(() => validateIdentifier("123abc")).toThrow(
			"Invalid SQL identifier",
		);
	});
});

describe("generateSetupSQL", () => {
	it("generates schema, table, and index SQL with dimensions", () => {
		const sql = generateSetupSQL("public", "documents", 384);

		expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS vector");
		expect(sql).toContain("CREATE SCHEMA IF NOT EXISTS public");
		expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.documents");
		expect(sql).toContain("VECTOR(384)");
		expect(sql).toContain("CREATE INDEX IF NOT EXISTS documents_vector_idx");
		expect(sql).toContain("USING hnsw (vector vector_cosine_ops)");
	});

	it("uses custom schema and table names", () => {
		const sql = generateSetupSQL("rag", "knowledge_base", 768);

		expect(sql).toContain("CREATE SCHEMA IF NOT EXISTS rag");
		expect(sql).toContain("CREATE TABLE IF NOT EXISTS rag.knowledge_base");
		expect(sql).toContain(
			"CREATE INDEX IF NOT EXISTS knowledge_base_vector_idx",
		);
		expect(sql).toContain("VECTOR(768)");
	});
});

describe("generateRecreateSQL", () => {
	it("includes drop table before setup SQL", () => {
		const sql = generateRecreateSQL("public", "documents", 1536);

		expect(sql).toContain("DROP TABLE IF EXISTS public.documents");
		expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.documents");
		expect(sql).toContain("VECTOR(1536)");
		expect(sql.indexOf("DROP TABLE")).toBeLessThan(sql.indexOf("CREATE TABLE"));
	});
});

describe("parseVectorDimension", () => {
	it("parses vector dimensions", () => {
		expect(parseVectorDimension("[0.1,0.2,0.3]")).toBe(3);
	});

	it("returns 0 for empty vectors", () => {
		expect(parseVectorDimension("[]")).toBe(0);
	});
});
