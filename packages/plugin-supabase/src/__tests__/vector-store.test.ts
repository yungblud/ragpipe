import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn();
const mockFrom = vi.fn();

const mockCreateClient = vi.fn(() => ({
	rpc: mockRpc,
	from: mockFrom,
}));

vi.mock("@supabase/supabase-js", () => ({
	createClient: mockCreateClient,
}));

describe("supabaseVectorStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates Supabase client with URL and key", async () => {
		const { supabaseVectorStore } = await import("../vector-store.js");
		supabaseVectorStore({
			supabaseUrl: "https://abc.supabase.co",
			supabaseKey: "test-key",
		});
		expect(mockCreateClient).toHaveBeenCalledWith(
			"https://abc.supabase.co",
			"test-key",
		);
	});

	it("has correct name", async () => {
		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			supabaseUrl: "https://abc.supabase.co",
			supabaseKey: "test-key",
		});
		expect(store.name).toBe("supabase");
	});

	it("searches via rpc with default query name", async () => {
		const fakeResults = [
			{ source: "doc.md", content: "hello", similarity: 0.95 },
		];
		mockRpc.mockResolvedValueOnce({ data: fakeResults, error: null });

		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			supabaseUrl: "https://abc.supabase.co",
			supabaseKey: "test-key",
		});

		const results = await store.search([0.1, 0.2, 0.3], 5);

		expect(mockRpc).toHaveBeenCalledWith("match_documents", {
			query_embedding: [0.1, 0.2, 0.3],
			match_count: 5,
		});
		expect(results).toEqual([
			{ source: "doc.md", content: "hello", score: 0.95 },
		]);
	});

	it("searches with custom query name", async () => {
		mockRpc.mockResolvedValueOnce({ data: [], error: null });

		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			supabaseUrl: "https://abc.supabase.co",
			supabaseKey: "test-key",
			queryName: "custom_match",
		});

		await store.search([0.1], 3);
		expect(mockRpc).toHaveBeenCalledWith("custom_match", {
			query_embedding: [0.1],
			match_count: 3,
		});
	});

	it("throws on search error", async () => {
		mockRpc.mockResolvedValueOnce({
			data: null,
			error: { message: "Function not found" },
		});

		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			supabaseUrl: "https://abc.supabase.co",
			supabaseKey: "test-key",
		});

		await expect(store.search([0.1], 5)).rejects.toThrow(
			"Supabase search error: Function not found",
		);
	});

	it("upserts documents via from().upsert()", async () => {
		const mockUpsert = vi.fn().mockResolvedValueOnce({ error: null });
		mockFrom.mockReturnValueOnce({ upsert: mockUpsert });

		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			supabaseUrl: "https://abc.supabase.co",
			supabaseKey: "test-key",
		});

		await store.upsert("doc.md", "hello", [0.1, 0.2]);

		expect(mockFrom).toHaveBeenCalledWith("documents");
		expect(mockUpsert).toHaveBeenCalledWith(
			{ source: "doc.md", content: "hello", vector: [0.1, 0.2] },
			{ onConflict: "source,content" },
		);
	});

	it("clears table via from().delete()", async () => {
		const mockGte = vi.fn().mockResolvedValueOnce({ error: null });
		const mockDelete = vi.fn().mockReturnValueOnce({ gte: mockGte });
		mockFrom.mockReturnValueOnce({ delete: mockDelete });

		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			supabaseUrl: "https://abc.supabase.co",
			supabaseKey: "test-key",
		});

		await store.clear?.();

		expect(mockFrom).toHaveBeenCalledWith("documents");
		expect(mockDelete).toHaveBeenCalled();
		expect(mockGte).toHaveBeenCalledWith("id", 0);
	});

	it("disconnect is a no-op", async () => {
		const { supabaseVectorStore } = await import("../vector-store.js");
		const store = supabaseVectorStore({
			supabaseUrl: "https://abc.supabase.co",
			supabaseKey: "test-key",
		});

		await expect(store.disconnect?.()).resolves.toBeUndefined();
	});
});
