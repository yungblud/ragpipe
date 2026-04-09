import { defineCommand } from "citty";
import consola from "consola";
import { loadConfig } from "../config.js";

export const setupCommand = defineCommand({
	meta: {
		name: "setup",
		description: "Set up vector store schema",
	},
	args: {
		force: {
			type: "boolean",
			description:
				"Force recreate table even if data exists (data will be lost)",
			default: false,
		},
	},
	async run({ args }) {
		const config = await loadConfig();
		const { embedding, vectorStore } = config;

		consola.info(
			`Embedding: ${embedding.name}, dimensions: ${embedding.dimensions}`,
		);

		if (!vectorStore.setup) {
			consola.warn(
				`${vectorStore.name} does not support auto-setup. Manual configuration required.`,
			);
			return;
		}

		await vectorStore.setup(embedding.dimensions, { force: args.force });
		consola.success("Vector store setup complete!");
	},
});
