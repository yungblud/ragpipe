import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	SQLITE_VECTOR_STORE_DEFAULT_META_TABLE,
	SQLITE_VECTOR_STORE_DEFAULT_TABLE,
	SQLITE_VECTOR_STORE_DIMENSIONS_KEY,
	createContentHash,
	formatVector,
} from "../sql.js";

type Row = {
	source: string;
	content: string;
	content_hash: string;
	vector: string;
};

class FakeDatabase {
	path: string;
	rows: Row[] = [];
	meta = new Map<string, string>();
	documentsTableExists = false;
	metaTableExists = false;
	closed = false;
	pragmaCalls: string[] = [];
	execCalls: string[] = [];
	prepareCalls: string[] = [];

	constructor(path: string) {
		this.path = path;
	}

	pragma(source: string): void {
		this.pragmaCalls.push(source);
	}

	exec(source: string): void {
		this.execCalls.push(source);

		if (source.includes("DROP TABLE IF EXISTS")) {
			this.rows = [];
			this.meta.clear();
		}

		if (
			source.includes(
				`CREATE TABLE IF NOT EXISTS ${SQLITE_VECTOR_STORE_DEFAULT_TABLE}`,
			)
		) {
			this.documentsTableExists = true;
		}

		if (
			source.includes(
				`CREATE TABLE IF NOT EXISTS ${SQLITE_VECTOR_STORE_DEFAULT_META_TABLE}`,
			)
		) {
			this.metaTableExists = true;
		}

		if (
			source.includes("DROP TABLE IF EXISTS documents") ||
			source.includes("DROP TABLE IF EXISTS custom_docs")
		) {
			this.documentsTableExists = false;
		}

		if (
			source.includes("DROP TABLE IF EXISTS ragpipe_meta") ||
			source.includes("DROP TABLE IF EXISTS custom_meta")
		) {
			this.metaTableExists = false;
		}

		if (source.includes("CREATE TABLE IF NOT EXISTS custom_docs")) {
			this.documentsTableExists = true;
		}

		if (source.includes("CREATE TABLE IF NOT EXISTS custom_meta")) {
			this.metaTableExists = true;
		}
	}

	close(): void {
		this.closed = true;
	}

	prepare(source: string) {
		this.prepareCalls.push(source);

		return {
			run: (...params: unknown[]) => {
				if (
					source.startsWith("INSERT INTO ragpipe_meta") ||
					source.startsWith("INSERT INTO custom_meta")
				) {
					this.meta.set(String(params[0]), String(params[1]));
					return;
				}

				if (
					source.startsWith("INSERT INTO documents") ||
					source.startsWith("INSERT INTO custom_docs")
				) {
					const [sourceValue, content, contentHash, vector] = params as [
						string,
						string,
						string,
						string,
					];
					const existingIndex = this.rows.findIndex(
						(row) =>
							row.source === sourceValue && row.content_hash === contentHash,
					);

					const nextRow = {
						source: sourceValue,
						content,
						content_hash: contentHash,
						vector,
					};

					if (existingIndex >= 0) {
						this.rows[existingIndex] = nextRow;
					} else {
						this.rows.push(nextRow);
					}
					return;
				}

				if (
					source.startsWith("DELETE FROM documents") ||
					source.startsWith("DELETE FROM custom_docs")
				) {
					this.rows = [];
				}
			},
			get: (...params: unknown[]) => {
				if (
					source.includes("FROM sqlite_master") &&
					source.includes("name = 'documents'")
				) {
					return this.documentsTableExists ? { name: "documents" } : undefined;
				}

				if (
					source.includes("FROM sqlite_master") &&
					source.includes("name = 'ragpipe_meta'")
				) {
					return this.metaTableExists ? { name: "ragpipe_meta" } : undefined;
				}

				if (
					source.includes("FROM sqlite_master") &&
					source.includes("name = 'custom_docs'")
				) {
					return this.documentsTableExists
						? { name: "custom_docs" }
						: undefined;
				}

				if (
					source.includes("FROM sqlite_master") &&
					source.includes("name = 'custom_meta'")
				) {
					return this.metaTableExists ? { name: "custom_meta" } : undefined;
				}

				if (source.startsWith("SELECT COUNT(*) AS count FROM")) {
					return { count: this.rows.length };
				}

				if (source.startsWith("SELECT value FROM")) {
					const value = this.meta.get(String(params[0]));
					return value === undefined ? undefined : { value };
				}

				if (source.startsWith("SELECT vector FROM")) {
					const row = this.rows[0];
					return row ? { vector: row.vector } : undefined;
				}

				return undefined;
			},
			all: () => {
				if (source.startsWith("SELECT source, content, vector FROM")) {
					return this.rows.map((row) => ({
						source: row.source,
						content: row.content,
						vector: row.vector,
					}));
				}

				return [];
			},
		};
	}
}

const fakeDatabases: FakeDatabase[] = [];

function getCreatedDatabase(): FakeDatabase {
	const database = fakeDatabases[0];

	if (!database) {
		throw new Error(
			"Expected sqliteVectorStore to create a database instance.",
		);
	}

	return database;
}

const MockDatabase = class extends FakeDatabase {
	constructor(path: string) {
		super(path);
		fakeDatabases.push(this);
	}
};

vi.mock("better-sqlite3", () => ({
	default: MockDatabase,
}));

describe("sqliteVectorStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		fakeDatabases.length = 0;
	});

	it("creates the database lazily and sets WAL mode", async () => {
		const { sqliteVectorStore } = await import("../vector-store.js");
		const store = sqliteVectorStore({ path: "./rag.db" });

		await store.isReady?.();

		expect(fakeDatabases[0]?.path).toBe("./rag.db");
		expect(fakeDatabases[0]?.pragmaCalls).toEqual(["journal_mode = WAL"]);
	});

	it("searches, ranks by similarity, and uses deterministic tie-breaks", async () => {
		const { sqliteVectorStore } = await import("../vector-store.js");
		const store = sqliteVectorStore({ path: "./rag.db" });
		await store.isReady?.();
		const db = getCreatedDatabase();
		db.documentsTableExists = true;
		db.metaTableExists = true;
		db.meta.set(SQLITE_VECTOR_STORE_DIMENSIONS_KEY, "2");
		db.rows = [
			{
				source: "z.md",
				content: "alpha",
				content_hash: createContentHash("alpha"),
				vector: formatVector([1, 0]),
			},
			{
				source: "a.md",
				content: "beta",
				content_hash: createContentHash("beta"),
				vector: formatVector([1, 0]),
			},
			{
				source: "m.md",
				content: "gamma",
				content_hash: createContentHash("gamma"),
				vector: formatVector([0, 1]),
			},
		];

		const results = await store.search([1, 0], 2);

		expect(results).toEqual([
			{ source: "a.md", content: "beta", score: 1 },
			{ source: "z.md", content: "alpha", score: 1 },
		]);
	});

	it("upserts with content hash conflict semantics", async () => {
		const { sqliteVectorStore } = await import("../vector-store.js");
		const store = sqliteVectorStore({ path: "./rag.db" });
		await store.isReady?.();
		const db = getCreatedDatabase();
		db.documentsTableExists = true;
		db.metaTableExists = true;
		db.meta.set(SQLITE_VECTOR_STORE_DIMENSIONS_KEY, "2");

		await store.upsert("doc.md", "hello", [1, 0]);
		await store.upsert("doc.md", "hello", [0, 1]);

		expect(db.rows).toHaveLength(1);
		expect(db.rows[0]).toMatchObject({
			source: "doc.md",
			content: "hello",
			content_hash: createContentHash("hello"),
			vector: formatVector([0, 1]),
		});
	});

	it("clears rows and disconnects the database", async () => {
		const { sqliteVectorStore } = await import("../vector-store.js");
		const store = sqliteVectorStore({ path: "./rag.db" });
		await store.isReady?.();
		const db = getCreatedDatabase();
		db.documentsTableExists = true;
		db.metaTableExists = true;
		db.meta.set(SQLITE_VECTOR_STORE_DIMENSIONS_KEY, "2");
		db.rows = [
			{
				source: "doc.md",
				content: "hello",
				content_hash: createContentHash("hello"),
				vector: formatVector([1, 0]),
			},
		];

		await store.clear?.();
		await store.disconnect?.();

		expect(db.rows).toEqual([]);
		expect(db.closed).toBe(true);
	});

	it("reports readiness only when both tables exist", async () => {
		const { sqliteVectorStore } = await import("../vector-store.js");
		const store = sqliteVectorStore({ path: "./rag.db" });
		await store.isReady?.();
		const db = getCreatedDatabase();

		db.documentsTableExists = true;
		db.metaTableExists = false;
		await expect(store.isReady?.()).resolves.toBe(false);

		db.metaTableExists = true;
		await expect(store.isReady?.()).resolves.toBe(true);
	});

	describe("setup", () => {
		it("creates tables and stores dimensions when not ready", async () => {
			const { sqliteVectorStore } = await import("../vector-store.js");
			const store = sqliteVectorStore({ path: "./rag.db" });
			await store.isReady?.();
			const db = getCreatedDatabase();

			await store.setup?.(384);

			expect(db.execCalls[0]).toContain("CREATE TABLE IF NOT EXISTS documents");
			expect(db.meta.get(SQLITE_VECTOR_STORE_DIMENSIONS_KEY)).toBe("384");
		});

		it("recreates tables when empty", async () => {
			const { sqliteVectorStore } = await import("../vector-store.js");
			const store = sqliteVectorStore({ path: "./rag.db" });
			await store.isReady?.();
			const db = getCreatedDatabase();
			db.documentsTableExists = true;
			db.metaTableExists = true;

			await store.setup?.(128);

			expect(db.execCalls[0]).toContain("DROP TABLE IF EXISTS documents");
			expect(db.meta.get(SQLITE_VECTOR_STORE_DIMENSIONS_KEY)).toBe("128");
		});

		it("recreates tables when force is true", async () => {
			const { sqliteVectorStore } = await import("../vector-store.js");
			const store = sqliteVectorStore({ path: "./rag.db" });
			await store.isReady?.();
			const db = getCreatedDatabase();
			db.documentsTableExists = true;
			db.metaTableExists = true;
			db.rows = [
				{
					source: "doc.md",
					content: "hello",
					content_hash: createContentHash("hello"),
					vector: formatVector([1, 0]),
				},
			];

			await store.setup?.(128, { force: true });

			expect(db.execCalls[0]).toContain("DROP TABLE IF EXISTS documents");
			expect(db.meta.get(SQLITE_VECTOR_STORE_DIMENSIONS_KEY)).toBe("128");
		});

		it("preserves an existing matching configuration", async () => {
			const { sqliteVectorStore } = await import("../vector-store.js");
			const store = sqliteVectorStore({ path: "./rag.db" });
			await store.isReady?.();
			const db = getCreatedDatabase();
			db.documentsTableExists = true;
			db.metaTableExists = true;
			db.rows = [
				{
					source: "doc.md",
					content: "hello",
					content_hash: createContentHash("hello"),
					vector: formatVector([1, 0]),
				},
			];
			db.meta.set(SQLITE_VECTOR_STORE_DIMENSIONS_KEY, "2");

			await expect(store.setup?.(2)).resolves.toBeUndefined();
			expect(db.execCalls).toEqual([]);
		});

		it("throws on dimension mismatch without force", async () => {
			const { sqliteVectorStore } = await import("../vector-store.js");
			const store = sqliteVectorStore({ path: "./rag.db" });
			await store.isReady?.();
			const db = getCreatedDatabase();
			db.documentsTableExists = true;
			db.metaTableExists = true;
			db.rows = [
				{
					source: "doc.md",
					content: "hello",
					content_hash: createContentHash("hello"),
					vector: formatVector([1, 0]),
				},
			];
			db.meta.set(SQLITE_VECTOR_STORE_DIMENSIONS_KEY, "2");

			await expect(store.setup?.(3)).rejects.toThrow(
				"Dimension mismatch: table has 2, config requires 3. Use setup --force to recreate (data will be lost).",
			);
		});
	});

	it("throws when query dimensions do not match stored dimensions", async () => {
		const { sqliteVectorStore } = await import("../vector-store.js");
		const store = sqliteVectorStore({ path: "./rag.db" });
		await store.isReady?.();
		const db = getCreatedDatabase();
		db.documentsTableExists = true;
		db.metaTableExists = true;
		db.meta.set(SQLITE_VECTOR_STORE_DIMENSIONS_KEY, "2");

		await expect(store.search([1, 0, 0], 5)).rejects.toThrow(
			"Dimension mismatch: store is configured for 2, query has 3.",
		);
		await expect(store.upsert("doc.md", "hello", [1, 0, 0])).rejects.toThrow(
			"Dimension mismatch: store is configured for 2, query has 3.",
		);
	});
});
