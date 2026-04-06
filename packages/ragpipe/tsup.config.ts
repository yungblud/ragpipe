import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: ["src/index.ts"],
		format: ["esm", "cjs"],
		dts: true,
		clean: true,
		splitting: false,
	},
	{
		entry: { cli: "src/cli.ts" },
		format: ["esm"],
		dts: false,
		clean: false,
		splitting: false,
		banner: { js: "#!/usr/bin/env node" },
	},
]);
