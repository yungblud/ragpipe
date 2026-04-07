import { defineCommand } from "citty";
import consola from "consola";
import { loadConfig } from "../config.js";
import { createPipeline } from "../pipeline.js";

export const askCommand = defineCommand({
	meta: {
		name: "ask",
		description: "Ask a question against ingested documents",
	},
	args: {
		query: {
			type: "positional",
			description: "The question to ask",
			required: true,
		},
		topK: {
			type: "string",
			description: "Number of context chunks to retrieve",
			default: "5",
		},
	},
	async run({ args }) {
		const query = args.query;
		const topK = Number.parseInt(args.topK, 10);

		consola.start(`Asking: "${query}"`);

		const config = await loadConfig();
		const pipeline = createPipeline(config);

		const result = await pipeline.ask(query, topK);

		console.log(`\n${result.answer}\n`);

		if (result.sources.length > 0) {
			consola.info("Sources:");
			for (const source of result.sources) {
				consola.log(`  • ${source.source} (score: ${source.score.toFixed(3)})`);
			}
		}

		if (config.vectorStore.disconnect) {
			await config.vectorStore.disconnect();
		}
	},
});
