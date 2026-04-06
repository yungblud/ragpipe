import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineCommand } from "citty";
import consola from "consola";

interface ProviderOption {
	label: string;
	value: string;
	package: string;
	importName: string;
}

const EMBEDDING_PROVIDERS: ProviderOption[] = [
	{
		label: "Gemini (Google)",
		value: "gemini",
		package: "@ragpipe/plugin-gemini",
		importName: "geminiEmbedding",
	},
];

const VECTORSTORE_PROVIDERS: ProviderOption[] = [
	{
		label: "Supabase (pgvector)",
		value: "supabase",
		package: "@ragpipe/plugin-supabase",
		importName: "supabaseVectorStore",
	},
];

const GENERATION_PROVIDERS: ProviderOption[] = [
	{
		label: "Gemini",
		value: "gemini",
		package: "@ragpipe/plugin-gemini",
		importName: "geminiGeneration",
	},
];

function generateConfig(
	embedding: ProviderOption,
	vectorStore: ProviderOption,
	generation: ProviderOption,
): string {
	const imports = new Map<string, string[]>();

	for (const p of [embedding, vectorStore, generation]) {
		const existing = imports.get(p.package) ?? [];
		if (!existing.includes(p.importName)) {
			existing.push(p.importName);
		}
		imports.set(p.package, existing);
	}

	const importLines = [
		'import { defineConfig } from "ragpipe";',
		...Array.from(imports.entries()).map(
			([pkg, names]) => `import { ${names.join(", ")} } from "${pkg}";`,
		),
	].join("\n");

	return `${importLines}

export default defineConfig({
	embedding: ${embedding.importName}({
		apiKey: process.env.${embedding.value === "gemini" ? "GEMINI_API_KEY" : "API_KEY"}!,
	}),
	vectorStore: ${vectorStore.importName}({
		${vectorStore.value === "supabase" ? "databaseUrl: process.env.DATABASE_URL!," : ""}
	}),
	generation: ${generation.importName}({
		apiKey: process.env.${generation.value === "gemini" ? "GEMINI_API_KEY" : "API_KEY"}!,
	}),
});
`;
}

async function selectProvider(
	label: string,
	providers: ProviderOption[],
): Promise<ProviderOption> {
	if (providers.length === 1) {
		consola.info(`${label}: ${providers[0].label} (only available option)`);
		return providers[0];
	}

	const selected = await consola.prompt(label, {
		type: "select",
		options: providers.map((p) => p.label),
	});

	if (typeof selected === "symbol") {
		throw new Error("Selection cancelled");
	}

	return providers.find((p) => p.label === selected) ?? providers[0];
}

export const initCommand = defineCommand({
	meta: {
		name: "init",
		description: "Initialize a ragpipe project — scaffold ragpipe.config.ts",
	},
	async run() {
		consola.start("Initializing ragpipe project...\n");

		const embedding = await selectProvider(
			"Select an Embedding provider",
			EMBEDDING_PROVIDERS,
		);
		const vectorStore = await selectProvider(
			"Select a VectorStore",
			VECTORSTORE_PROVIDERS,
		);
		const generation = await selectProvider(
			"Select a Generation LLM",
			GENERATION_PROVIDERS,
		);

		const configContent = generateConfig(embedding, vectorStore, generation);
		const configPath = resolve(process.cwd(), "ragpipe.config.ts");
		await writeFile(configPath, configContent, "utf-8");

		consola.success("ragpipe.config.ts created");

		const packages = new Set<string>();
		for (const p of [embedding, vectorStore, generation]) {
			packages.add(p.package);
		}

		consola.info(
			`Required packages: ragpipe, ${Array.from(packages).join(", ")}`,
		);
		consola.info(`Run: pnpm add ragpipe ${Array.from(packages).join(" ")}`);
	},
});
