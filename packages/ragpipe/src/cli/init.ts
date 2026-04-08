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
	{
		label: "Cloudflare Workers AI",
		value: "cloudflare",
		package: "@ragpipe/plugin-cloudflare",
		importName: "cloudflareEmbedding",
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
	{
		label: "Cloudflare Workers AI",
		value: "cloudflare",
		package: "@ragpipe/plugin-cloudflare",
		importName: "cloudflareGeneration",
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

	function providerConfig(p: ProviderOption): string {
		if (p.value === "cloudflare") {
			return "accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,\n\t\tapiToken: process.env.CLOUDFLARE_API_TOKEN!,";
		}
		if (p.value === "supabase") {
			return "supabaseUrl: process.env.SUPABASE_URL!,\n\t\tsupabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,";
		}
		if (p.value === "gemini") {
			return "apiKey: process.env.GEMINI_API_KEY!,";
		}
		return "apiKey: process.env.API_KEY!,";
	}

	return `${importLines}

export default defineConfig({
	embedding: ${embedding.importName}({
		${providerConfig(embedding)}
	}),
	vectorStore: ${vectorStore.importName}({
		${providerConfig(vectorStore)}
	}),
	generation: ${generation.importName}({
		${providerConfig(generation)}
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
