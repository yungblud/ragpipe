import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnd = vi.fn();
const mockQuery = vi.fn((): Promise<unknown[]> => Promise.resolve([]));

const mockPostgres = vi.fn(() => {
	const handler = {
		apply(
			_target: unknown,
			_thisArg: unknown,
			args: [string | TemplateStringsArray, ...unknown[]],
		) {
			if (typeof args[0] === "string") {
				return args[0];
			}
			return mockQuery();
		},
	};

	const sql = new Proxy(() => {}, handler) as unknown as ((
		strings: TemplateStringsArray,
		...values: unknown[]
	) => Promise<unknown[]>) & {
		end: typeof mockEnd;
		(identifier: string): string;
	};

	Object.assign(sql, { end: mockEnd });

	return sql;
});

vi.mock("postgres", () => ({
	default: mockPostgres,
}));

describe("supabaseVectorStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates postgres connection with database URL", async () => {
		const { supabaseVectorStore } = await import("../vector-store.js");
		supabaseVectorStore({ databaseUrl: "postgres://localhost/test" });
		expect(mockPostgres).toHaveBeenCalledWith("postgres://localhost/test");
	});

	it("has correct name", async () => {
		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			databaseUrl: "postgres://localhost/test",
		});
		expect(store.name).toBe("supabase");
	});

	it("calls disconnect / sql.end()", async () => {
		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			databaseUrl: "postgres://localhost/test",
		});
		await store.disconnect?.();
		expect(mockEnd).toHaveBeenCalledOnce();
	});

	it("returns search results", async () => {
		const fakeResults = [{ source: "doc.md", content: "hello", score: 0.95 }];
		mockQuery.mockResolvedValueOnce(fakeResults);

		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			databaseUrl: "postgres://localhost/test",
		});

		const results = await store.search([0.1, 0.2, 0.3], 5);
		expect(results).toEqual(fakeResults);
		expect(mockQuery).toHaveBeenCalled();
	});

	it("upserts documents", async () => {
		mockQuery.mockResolvedValueOnce([]);

		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			databaseUrl: "postgres://localhost/test",
		});

		await expect(
			store.upsert("doc.md", "hello", [0.1, 0.2]),
		).resolves.toBeUndefined();
		expect(mockQuery).toHaveBeenCalled();
	});

	it("clears table", async () => {
		mockQuery.mockResolvedValueOnce([]);

		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			databaseUrl: "postgres://localhost/test",
		});

		await store.clear?.();
		expect(mockQuery).toHaveBeenCalled();
	});
});
