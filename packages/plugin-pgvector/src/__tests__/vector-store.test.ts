import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();
const mockEnd = vi.fn();
const mockPool = vi.fn(() => ({
	query: mockQuery,
	end: mockEnd,
}));

vi.mock("pg", () => ({
	Pool: mockPool,
}));

describe("pgVectorStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a pool with connection string and optional ssl", async () => {
		const { pgVectorStore } = await import("../vector-store.js");

		pgVectorStore({
			connectionString: "postgresql://user:pass@localhost:5432/ragpipe",
			ssl: true,
		});

		expect(mockPool).toHaveBeenCalledWith({
			connectionString: "postgresql://user:pass@localhost:5432/ragpipe",
			ssl: { rejectUnauthorized: false },
		});
	});

	it("has correct name", async () => {
		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
		});

		expect(store.name).toBe("pgvector");
	});

	it("searches with vector cast and maps rows", async () => {
		mockQuery.mockResolvedValueOnce({
			rows: [{ source: "doc.md", content: "hello", similarity: "0.95" }],
		});

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
		});

		const results = await store.search([0.1, 0.2, 0.3], 5);

		expect(mockQuery).toHaveBeenCalledWith(
			expect.stringContaining(
				"SELECT source, content, 1 - (vector <=> $1::vector) AS similarity",
			),
			["[0.1,0.2,0.3]", 5],
		);
		expect(results).toEqual([
			{ source: "doc.md", content: "hello", score: 0.95 },
		]);
	});

	it("uses custom schema and table name in search queries", async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
			schema: "rag",
			tableName: "knowledge_base",
		});

		await store.search([0.1], 3);

		expect(mockQuery).toHaveBeenCalledWith(
			expect.stringContaining("FROM rag.knowledge_base"),
			["[0.1]", 3],
		);
	});

	it("propagates search query errors", async () => {
		mockQuery.mockRejectedValueOnce(new Error("search failed"));

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
		});

		await expect(store.search([0.1], 5)).rejects.toThrow("search failed");
	});

	it("upserts with conflict target and vector string", async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
			schema: "rag",
			tableName: "knowledge_base",
		});

		await store.upsert("doc.md", "hello", [1, 2]);

		expect(mockQuery).toHaveBeenCalledWith(
			expect.stringContaining(
				"INSERT INTO rag.knowledge_base (source, content, vector)",
			),
			["doc.md", "hello", "[1,2]"],
		);
	});

	it("propagates upsert query errors", async () => {
		mockQuery.mockRejectedValueOnce(new Error("upsert failed"));

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
		});

		await expect(store.upsert("doc.md", "hello", [1, 2])).rejects.toThrow(
			"upsert failed",
		);
	});

	it("clears with truncate", async () => {
		mockQuery.mockResolvedValueOnce({ rows: [] });

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
		});

		await store.clear?.();

		expect(mockQuery).toHaveBeenCalledWith("TRUNCATE public.documents");
	});

	it("propagates clear query errors", async () => {
		mockQuery.mockRejectedValueOnce(new Error("clear failed"));

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
		});

		await expect(store.clear?.()).rejects.toThrow("clear failed");
	});

	it("disconnects pool", async () => {
		mockEnd.mockResolvedValueOnce(undefined);

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
		});

		await store.disconnect?.();

		expect(mockEnd).toHaveBeenCalled();
	});

	it("isReady returns true when select succeeds", async () => {
		mockQuery.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
		});

		await expect(store.isReady?.()).resolves.toBe(true);
	});

	it("isReady returns false when select fails", async () => {
		mockQuery.mockRejectedValueOnce(new Error("relation does not exist"));

		const { pgVectorStore } = await import("../vector-store.js");
		const store = pgVectorStore({
			connectionString: "postgresql://localhost/db",
		});

		await expect(store.isReady?.()).resolves.toBe(false);
	});

	describe("setup", () => {
		it("creates setup SQL when table is not ready", async () => {
			mockQuery.mockRejectedValueOnce(new Error("relation does not exist"));
			mockQuery.mockResolvedValueOnce({ rows: [] });

			const { pgVectorStore } = await import("../vector-store.js");
			const store = pgVectorStore({
				connectionString: "postgresql://localhost/db",
			});

			await store.setup?.(384);

			expect(mockQuery).toHaveBeenNthCalledWith(
				2,
				expect.stringContaining("CREATE TABLE IF NOT EXISTS public.documents"),
			);
		});

		it("recreates when table is empty", async () => {
			mockQuery
				.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
				.mockResolvedValueOnce({ rows: [{ count: 0 }] })
				.mockResolvedValueOnce({ rows: [] });

			const { pgVectorStore } = await import("../vector-store.js");
			const store = pgVectorStore({
				connectionString: "postgresql://localhost/db",
			});

			await store.setup?.(768);

			expect(mockQuery).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("DROP TABLE IF EXISTS public.documents"),
			);
		});

		it("recreates when force is true", async () => {
			mockQuery
				.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
				.mockResolvedValueOnce({ rows: [{ count: 5 }] })
				.mockResolvedValueOnce({ rows: [] });

			const { pgVectorStore } = await import("../vector-store.js");
			const store = pgVectorStore({
				connectionString: "postgresql://localhost/db",
			});

			await store.setup?.(768, { force: true });

			expect(mockQuery).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("DROP TABLE IF EXISTS public.documents"),
			);
		});

		it("passes when dimensions already match", async () => {
			mockQuery
				.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
				.mockResolvedValueOnce({ rows: [{ count: 2 }] })
				.mockResolvedValueOnce({ rows: [{ vector: "[0.1,0.2,0.3]" }] });

			const { pgVectorStore } = await import("../vector-store.js");
			const store = pgVectorStore({
				connectionString: "postgresql://localhost/db",
			});

			await expect(store.setup?.(3)).resolves.toBeUndefined();
			expect(mockQuery).toHaveBeenCalledTimes(3);
		});

		it("throws on dimension mismatch without force", async () => {
			mockQuery
				.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
				.mockResolvedValueOnce({ rows: [{ count: 2 }] })
				.mockResolvedValueOnce({ rows: [{ vector: "[0.1,0.2,0.3]" }] });

			const { pgVectorStore } = await import("../vector-store.js");
			const store = pgVectorStore({
				connectionString: "postgresql://localhost/db",
			});

			await expect(store.setup?.(768)).rejects.toThrow("Dimension mismatch");
		});

		it("wraps pgvector setup extension errors with guidance", async () => {
			mockQuery.mockRejectedValueOnce(
				new Error('extension "vector" is not available'),
			);
			mockQuery.mockRejectedValueOnce(
				new Error('extension "vector" is not available'),
			);

			const { pgVectorStore } = await import("../vector-store.js");
			const store = pgVectorStore({
				connectionString: "postgresql://localhost/db",
			});

			await expect(store.setup?.(384)).rejects.toThrow(
				"Install the pgvector extension on the database first.",
			);
		});

		it("uses custom schema and table name in setup queries", async () => {
			mockQuery
				.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
				.mockResolvedValueOnce({ rows: [{ count: 0 }] })
				.mockResolvedValueOnce({ rows: [] });

			const { pgVectorStore } = await import("../vector-store.js");
			const store = pgVectorStore({
				connectionString: "postgresql://localhost/db",
				schema: "rag",
				tableName: "knowledge_base",
			});

			await store.setup?.(384);

			expect(mockQuery).toHaveBeenNthCalledWith(
				2,
				"SELECT COUNT(*)::int AS count FROM rag.knowledge_base",
			);
			expect(mockQuery).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining("DROP TABLE IF EXISTS rag.knowledge_base"),
			);
		});
	});
});
