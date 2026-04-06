import { loadConfig as c12LoadConfig } from "c12";
import type { RagpipeConfig } from "./types.js";

export function defineConfig(config: RagpipeConfig): RagpipeConfig {
	return config;
}

export async function loadConfig(
	overrides?: Partial<RagpipeConfig>,
): Promise<RagpipeConfig> {
	const { config } = await c12LoadConfig<RagpipeConfig>({
		name: "ragpipe",
		defaults: overrides as RagpipeConfig,
	});

	if (!config) {
		throw new Error(
			"No ragpipe config found. Create a ragpipe.config.ts or pass config directly.",
		);
	}

	const cfg = config as RagpipeConfig;

	if (!cfg.embedding) {
		throw new Error("ragpipe config is missing 'embedding' plugin.");
	}
	if (!cfg.vectorStore) {
		throw new Error("ragpipe config is missing 'vectorStore' plugin.");
	}
	if (!cfg.generation) {
		throw new Error("ragpipe config is missing 'generation' plugin.");
	}

	return cfg;
}
