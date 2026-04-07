import { geminiEmbedding, geminiGeneration } from "@ragpipe/plugin-gemini";
import { supabaseVectorStore } from "@ragpipe/plugin-supabase";
import { defineConfig } from "ragpipe";

export default defineConfig({
	embedding: geminiEmbedding({
		apiKey: process.env.GEMINI_API_KEY ?? "",
		model: "gemini-embedding-001",
	}),
	vectorStore: supabaseVectorStore({
		supabaseUrl: process.env.SUPABASE_URL ?? "",
		supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
		tableName: "documents",
	}),
	generation: geminiGeneration({
		apiKey: process.env.GEMINI_API_KEY ?? "",
		model: "gemini-2.5-flash",
		systemPrompt: "Answer based on the provided context.",
	}),
});
