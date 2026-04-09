import { defineCommand } from "citty";
import consola from "consola";
import { loadConfig } from "../config.js";

export const setupCommand = defineCommand({
	meta: {
		name: "setup",
		description: "Set up vector store schema",
	},
	async run() {
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

		await vectorStore.setup(embedding.dimensions);
		consola.success("Vector store setup complete!");
	},
});
