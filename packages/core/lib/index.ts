export { TypeExtractor } from "./extractor.ts";
export {
	TypeLookup,
	type TypeMatch,
	type LookupOptions,
	type LookupResult,
	type UsageInfo,
} from "./lookup.ts";
export {
	prioritizeTypes,
	isBarrelFile,
	type PrioritizerConfig,
	type PrioritizeResult,
} from "./prioritizer.ts";
export { ContentFormatter, type FormatStats } from "./formatter.ts";
export type { ExtractedType, ExtractedTypeKind, Config } from "./types.ts";
export { defaultConfig } from "./config.ts";
export {
	extractSvelteScripts,
	loadSvelteParser,
	type SvelteScript,
	type SvelteParser,
} from "./svelte-utils.ts";
