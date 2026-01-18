/**
 * Type Prioritizer - Implements token budget with static tier priority ordering
 *
 * Tiers:
 * 1. Function signatures (ALWAYS include - this is the API)
 * 2. Types directly used in function signatures
 * 3. Types that Tier 2 depends on (transitive)
 * 4. Other local types (classes, enums, consts)
 * 5. Imported types not yet included
 */

import type { ExtractedType } from "./types.ts";

/** Default token budget (~1500 tokens ≈ 6000 chars at 4 chars/token) */
const DEFAULT_TOKEN_BUDGET = 1500;
const CHARS_PER_TOKEN = 4;

export type PrioritizerConfig = {
	/** Maximum tokens to include (default: 1500) */
	tokenBudget: number;
	/** Enable debug logging */
	debug: boolean;
};

export type PrioritizeResult = {
	/** Types to include, in priority order */
	types: ExtractedType[];
	/** Total estimated tokens */
	totalTokens: number;
	/** Whether budget was exceeded */
	budgetExceeded: boolean;
	/** Types excluded due to budget */
	excludedCount: number;
	/** Breakdown by tier */
	tierCounts: {
		tier1: number;
		tier2: number;
		tier3: number;
		tier4: number;
		tier5: number;
	};
};

/**
 * Prioritize types by tier and apply token budget
 */
export function prioritizeTypes(
	types: ExtractedType[],
	config: PrioritizerConfig = {
		tokenBudget: DEFAULT_TOKEN_BUDGET,
		debug: false,
	},
): PrioritizeResult {
	const { tokenBudget, debug } = config;

	// Step 1: Separate into tiers
	const tiers = assignTiers(types, debug);

	// Step 2: Apply token budget
	const result: ExtractedType[] = [];
	let totalTokens = 0;
	let budgetExceeded = false;
	const includedNames = new Set<string>();

	const tierCounts = { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0 };

	// Process each tier in order
	const tierOrder: Array<{
		tier: ExtractedType[];
		name: keyof typeof tierCounts;
		mustInclude: boolean;
	}> = [
		{ tier: tiers.tier1, name: "tier1", mustInclude: true }, // Functions MUST be included
		{ tier: tiers.tier2, name: "tier2", mustInclude: false },
		{ tier: tiers.tier3, name: "tier3", mustInclude: false },
		{ tier: tiers.tier4, name: "tier4", mustInclude: false },
		{ tier: tiers.tier5, name: "tier5", mustInclude: false },
	];

	for (const { tier, name, mustInclude } of tierOrder) {
		for (const type of tier) {
			// Skip if already included (type might appear in multiple tiers)
			if (includedNames.has(type.name)) continue;

			const typeTokens = estimateTokens(type);

			// Check budget (skip check for mustInclude tier)
			if (!mustInclude && totalTokens + typeTokens > tokenBudget) {
				budgetExceeded = true;
				continue; // Skip this type but continue checking others in case smaller ones fit
			}

			result.push(type);
			includedNames.add(type.name);
			totalTokens += typeTokens;
			tierCounts[name]++;
		}
	}

	const excludedCount = types.length - result.length;

	if (debug) {
		console.log(
			`[TypeInject] Prioritizer: ${result.length}/${types.length} types included`,
		);
		console.log(
			`[TypeInject] Tokens: ${totalTokens}/${tokenBudget} (budget ${budgetExceeded ? "exceeded" : "ok"})`,
		);
		console.log(
			`[TypeInject] Tiers: T1=${tierCounts.tier1}, T2=${tierCounts.tier2}, T3=${tierCounts.tier3}, T4=${tierCounts.tier4}, T5=${tierCounts.tier5}`,
		);
	}

	return {
		types: result,
		totalTokens,
		budgetExceeded,
		excludedCount,
		tierCounts,
	};
}

/**
 * Assign types to priority tiers
 */
function assignTiers(
	types: ExtractedType[],
	debug: boolean,
): {
	tier1: ExtractedType[];
	tier2: ExtractedType[];
	tier3: ExtractedType[];
	tier4: ExtractedType[];
	tier5: ExtractedType[];
} {
	const tier1: ExtractedType[] = []; // Functions
	const tier2: ExtractedType[] = []; // Types in function signatures
	const tier3: ExtractedType[] = []; // Dependencies of tier 2
	const tier4: ExtractedType[] = []; // Other local types
	const tier5: ExtractedType[] = []; // Imported types

	// Build a map of type names to types for quick lookup
	const typeMap = new Map<string, ExtractedType>();
	for (const type of types) {
		typeMap.set(type.name, type);
	}

	// Tier 1: All functions (these are the API)
	const functions = types.filter((t) => t.kind === "function");
	tier1.push(...functions);

	// Collect type names referenced in function signatures
	const tier2Names = new Set<string>();
	for (const func of functions) {
		const referencedTypes = extractTypeReferences(func.signature);
		for (const name of referencedTypes) {
			if (typeMap.has(name) && name !== func.name) {
				tier2Names.add(name);
			}
		}
	}

	// Tier 2: Types directly used in function signatures
	for (const name of tier2Names) {
		const type = typeMap.get(name);
		if (type && type.kind !== "function") {
			tier2.push(type);
		}
	}

	// Collect type names referenced in tier 2 types (dependencies)
	const tier3Names = new Set<string>();
	for (const type of tier2) {
		const referencedTypes = extractTypeReferences(type.signature);
		for (const name of referencedTypes) {
			if (typeMap.has(name) && !tier2Names.has(name) && name !== type.name) {
				tier3Names.add(name);
			}
		}
	}

	// Tier 3: Dependencies of tier 2 types
	for (const name of tier3Names) {
		const type = typeMap.get(name);
		if (type && type.kind !== "function") {
			tier3.push(type);
		}
	}

	// Remaining types go to tier 4 (local) or tier 5 (imported)
	const assignedNames = new Set([
		...functions.map((f) => f.name),
		...tier2Names,
		...tier3Names,
	]);

	for (const type of types) {
		if (assignedNames.has(type.name)) continue;
		if (type.kind === "function") continue; // Functions already in tier 1

		if (type.sourcePath) {
			// Imported type
			tier5.push(type);
		} else {
			// Local type
			tier4.push(type);
		}
	}

	if (debug) {
		console.log(`[TypeInject] Tier assignment:`);
		console.log(
			`  Tier 1 (functions): ${tier1.map((t) => t.name).join(", ") || "none"}`,
		);
		console.log(
			`  Tier 2 (signature types): ${tier2.map((t) => t.name).join(", ") || "none"}`,
		);
		console.log(
			`  Tier 3 (dependencies): ${tier3.map((t) => t.name).join(", ") || "none"}`,
		);
		console.log(
			`  Tier 4 (other local): ${tier4.map((t) => t.name).join(", ") || "none"}`,
		);
		console.log(
			`  Tier 5 (imported): ${tier5.map((t) => t.name).join(", ") || "none"}`,
		);
	}

	return { tier1, tier2, tier3, tier4, tier5 };
}

/**
 * Extract type references from a signature string
 * Looks for PascalCase identifiers that are likely type names
 */
function extractTypeReferences(signature: string): Set<string> {
	const references = new Set<string>();

	// Match PascalCase identifiers (type names)
	// Excludes common built-in types
	const builtins = new Set([
		"String",
		"Number",
		"Boolean",
		"Object",
		"Array",
		"Function",
		"Promise",
		"Date",
		"Map",
		"Set",
		"WeakMap",
		"WeakSet",
		"RegExp",
		"Error",
		"Symbol",
		"BigInt",
		"Record",
		"Partial",
		"Required",
		"Readonly",
		"Pick",
		"Omit",
		"Exclude",
		"Extract",
		"NonNullable",
		"Parameters",
		"ReturnType",
		"InstanceType",
		"ThisType",
		"Uppercase",
		"Lowercase",
		"Capitalize",
		"Uncapitalize",
	]);

	// Match PascalCase words (start with uppercase, followed by lowercase)
	const pascalCaseRegex = /\b([A-Z][a-zA-Z0-9]*)\b/g;
	let match = pascalCaseRegex.exec(signature);

	while (match !== null) {
		const name = match[1];
		if (name && !builtins.has(name)) {
			references.add(name);
		}
		match = pascalCaseRegex.exec(signature);
	}

	return references;
}

/**
 * Estimate token count for a type
 */
function estimateTokens(type: ExtractedType): number {
	let chars = type.signature.length;

	// Add JSDoc if present
	if (type.jsdoc) {
		chars += type.jsdoc.join("\n").length;
	}

	// Add some overhead for formatting (newlines, etc.)
	chars += 10;

	return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * Check if a file is a barrel file (only exports, no actual code)
 */
export function isBarrelFile(content: string): boolean {
	// Remove comments
	const withoutComments = content
		.replace(/\/\*[\s\S]*?\*\//g, "") // Block comments
		.replace(/\/\/.*/g, ""); // Line comments

	// Split into statements
	const lines = withoutComments
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	if (lines.length === 0) return false;

	// Check if ALL non-empty lines are export statements
	const exportPatterns = [
		/^export\s*\*\s*from\s+['"]/, // export * from './foo'
		/^export\s*\{[^}]*\}\s*from\s+['"]/, // export { foo } from './foo'
		/^export\s+type\s*\*\s*from\s+['"]/, // export type * from './foo'
		/^export\s+type\s*\{[^}]*\}\s*from\s+['"]/, // export type { Foo } from './foo'
	];

	let exportCount = 0;
	let otherCount = 0;

	for (const line of lines) {
		const isExport = exportPatterns.some((pattern) => pattern.test(line));
		if (isExport) {
			exportCount++;
		} else {
			otherCount++;
		}
	}

	// It's a barrel file if it has exports and no other code
	// Allow some tolerance (e.g., a single type export alongside re-exports)
	return exportCount > 0 && otherCount === 0;
}
