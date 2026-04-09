import { defineCommand, runMain } from "citty";
import { askCommand } from "./cli/ask.js";
import { ingestCommand } from "./cli/ingest.js";
import { initCommand } from "./cli/init.js";
import { setupCommand } from "./cli/setup.js";

const main = defineCommand({
	meta: {
		name: "ragpipe",
		description: "Pluggable TypeScript RAG toolkit",
		version: "0.0.1",
	},
	subCommands: {
		init: initCommand,
		setup: setupCommand,
		ingest: ingestCommand,
		ask: askCommand,
	},
});

runMain(main);
