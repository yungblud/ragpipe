import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { defineCommand } from "citty";
import consola from "consola";
import { loadConfig } from "../config.js";
import { createPipeline } from "../pipeline.js";

const TEXT_EXTENSIONS = new Set([
	".md",
	".mdx",
	".txt",
	".csv",
	".json",
	".html",
	".htm",
	".xml",
	".yaml",
	".yml",
	".rst",
	".adoc",
	".tex",
	".log",
]);

async function collectFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name.startsWith(".") || entry.name === "node_modules") {
				continue;
			}
			files.push(...(await collectFiles(full)));
		} else if (TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
			files.push(full);
		}
	}

	return files;
}

export const ingestCommand = defineCommand({
	meta: {
		name: "ingest",
		description: "Ingest documents into the vector store",
	},
	args: {
		path: {
			type: "positional",
			description: "File or directory path to ingest",
			required: true,
		},
	},
	async run({ args }) {
		const target = args.path;
		consola.start(`Ingesting from ${target}...`);

		const config = await loadConfig();
		const pipeline = createPipeline(config);

		const targetStat = await stat(target);
		const files = targetStat.isDirectory()
			? await collectFiles(target)
			: [target];

		if (files.length === 0) {
			consola.warn("No text files found to ingest.");
			return;
		}

		consola.info(`Found ${files.length} file(s)`);

		let totalChunks = 0;
		for (const file of files) {
			const content = await readFile(file, "utf-8");
			const source = relative(process.cwd(), file);
			const chunks = await pipeline.ingest(content, source);
			totalChunks += chunks;
			consola.success(`${source} → ${chunks} chunks`);
		}

		consola.success(`Done! ${totalChunks} total chunks ingested.`);

		if (config.vectorStore.disconnect) {
			await config.vectorStore.disconnect();
		}
	},
});
