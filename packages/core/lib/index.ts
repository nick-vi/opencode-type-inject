export {
	type CheckResult,
	type Diagnostic,
	formatDiagnostics,
	getProjectDiagnostics,
} from "./checker.ts";
export { defaultConfig } from "./config.ts";
export { TypeExtractor } from "./extractor.ts";
export { ContentFormatter, type FormatStats } from "./formatter.ts";
export {
	type LookupOptions,
	type LookupResult,
	TypeLookup,
	type TypeMatch,
	type UsageInfo,
} from "./lookup.ts";
export {
	CHARS_PER_TOKEN,
	filterVisibleTypes,
	isBarrelFile,
	type PrioritizeResult,
	type PrioritizerConfig,
	prioritizeTypes,
} from "./prioritizer.ts";
export {
	extractSvelteScripts,
	loadSvelteParser,
	type SvelteParser,
	type SvelteScript,
} from "./svelte-utils.ts";
export type { Config, ExtractedType, ExtractedTypeKind } from "./types.ts";
