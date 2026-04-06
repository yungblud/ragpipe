import { geminiEmbedding, geminiGeneration } from "@ragpipe/plugin-gemini";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";
import { defineConfig } from "ragpipe";

export default defineConfig({
	embedding: geminiEmbedding({
		apiKey: process.env.GEMINI_API_KEY ?? "",
		model: "gemini-embedding-001",
	}),
	vectorStore: supabaseVectorStore({
		databaseUrl: process.env.DATABASE_URL ?? "",
		tableName: "documents",
		dimensions: 3072,
	}),
	generation: geminiGeneration({
		apiKey: process.env.GEMINI_API_KEY ?? "",
		model: "gemini-2.5-flash",
		systemPrompt: "Answer based on the provided context.",
	}),
});
