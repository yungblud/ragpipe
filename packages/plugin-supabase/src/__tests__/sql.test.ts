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
		expect(validateIdentifier("my_table")).toBe("my_table");
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
	it("generates CREATE TABLE with correct dimensions", () => {
		const sql = generateSetupSQL({
			tableName: "documents",
			queryName: "match_documents",
			dimensions: 384,
		});

		expect(sql).toContain("CREATE TABLE IF NOT EXISTS documents");
		expect(sql).toContain("VECTOR(384)");
		expect(sql).toContain("CREATE OR REPLACE FUNCTION match_documents");
		expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS vector");
	});
});

describe("generateRecreateSQL", () => {
	it("includes DROP statements before CREATE", () => {
		const sql = generateRecreateSQL({
			tableName: "documents",
			queryName: "match_documents",
			dimensions: 768,
		});

		expect(sql).toContain("DROP FUNCTION IF EXISTS match_documents");
		expect(sql).toContain("DROP TABLE IF EXISTS documents");
		expect(sql).toContain("CREATE TABLE IF NOT EXISTS documents");
		expect(sql).toContain("VECTOR(768)");
	});

	it("DROP comes before CREATE", () => {
		const sql = generateRecreateSQL({
			tableName: "docs",
			queryName: "match_docs",
			dimensions: 512,
		});

		const dropIdx = sql.indexOf("DROP TABLE");
		const createIdx = sql.indexOf("CREATE TABLE");
		expect(dropIdx).toBeLessThan(createIdx);
	});
});

describe("parseVectorDimension", () => {
	it("parses a 3-dimensional vector", () => {
		expect(parseVectorDimension("[0.1,0.2,0.3]")).toBe(3);
	});

	it("parses a 384-dimensional vector", () => {
		const vector = `[${Array(384).fill("0.1").join(",")}]`;
		expect(parseVectorDimension(vector)).toBe(384);
	});

	it("returns 0 for empty vector", () => {
		expect(parseVectorDimension("[]")).toBe(0);
	});
});
