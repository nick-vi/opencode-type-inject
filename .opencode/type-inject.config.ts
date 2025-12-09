import type { Config } from "./plugin/lib/types.ts";

export const defaultConfig: Config = {
	enabled: true,
	debug: false,
	includeJSDoc: true,

	inject: {
		functions: true,
		types: true,
		interfaces: true,
		enums: true,
		classes: true,
		constants: true,
	},

	format: {
		includeMarkers: true,
	},

	imports: {
		enabled: true,
		maxDepth: 4,
		includeTypeOnly: true,
	},

	filtering: {
		onlyUsed: true,
		includeTransitive: true,
	},

	budget: {
		maxTokens: 10000,
		skipBarrelFiles: true,
	},
};

export default defaultConfig;
