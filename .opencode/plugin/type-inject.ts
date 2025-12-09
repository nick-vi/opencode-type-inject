import { type Plugin, tool } from "@opencode-ai/plugin";
import { defaultConfig } from "../type-inject.config.ts";
import { TypeExtractor } from "./lib/extractor.ts";
import { ContentFormatter } from "./lib/formatter.ts";
import { TypeLookup } from "./lib/lookup.ts";
import { isBarrelFile, prioritizeTypes } from "./lib/prioritizer.ts";
import type { Config, ExtractedTypeKind } from "./lib/types.ts";

export const TypeInjectPlugin: Plugin = async ({ directory }) => {
	const config: Config = defaultConfig;

	if (config.debug) {
		console.log("🔌 [TypeInject] Plugin Loading...");
		console.log(`   Enabled: ${config.enabled}`);
		console.log(`   Debug: ${config.debug}`);
	}

	if (!config.enabled) {
		return {};
	}

	const extractor = new TypeExtractor(directory, config);
	const formatter = new ContentFormatter(config);
	const typeLookup = new TypeLookup(directory, config);

	if (config.debug) {
		console.log("✅ [TypeInject] Plugin initialized successfully");
	}

	const currentReads = new Map<
		string,
		{ filePath: string; offset?: number; limit?: number }
	>();

	return {
		tool: {
			lookup_type: tool({
				description:
					"Look up TypeScript type definitions by name. Returns the full type signature, file location, and optionally where it's used. Use this to quickly find type definitions without reading entire files.",
				args: {
					name: tool.schema
						.string()
						.describe("Type name to search for (e.g., 'User', 'Config')"),
					exact: tool.schema
						.boolean()
						.optional()
						.describe("Exact match (true) or contains (false). Default: true"),
					kind: tool.schema
						.array(
							tool.schema.enum([
								"function",
								"type",
								"interface",
								"enum",
								"class",
								"const",
							]),
						)
						.optional()
						.describe(
							"Filter by type kind. Options: function, type, interface, enum, class, const",
						),
					includeUsages: tool.schema
						.boolean()
						.optional()
						.describe(
							"Include files that import/use this type. Default: false (can be slow)",
						),
					limit: tool.schema
						.number()
						.optional()
						.describe("Maximum results to return. Default: 5"),
				},
				async execute(args) {
					const result = typeLookup.findType(args.name, {
						exact: args.exact ?? true,
						kind: args.kind as ExtractedTypeKind[] | undefined,
						includeUsages: args.includeUsages ?? false,
						limit: args.limit ?? 5,
					});

					if (!result.found) {
						return `No types found matching "${args.name}"`;
					}

					// Format output for LLM consumption
					const lines: string[] = [];
					lines.push(
						`Found ${result.totalMatches} type(s) matching "${args.name}" (showing ${result.types.length}):`,
					);
					lines.push("");

					for (const type of result.types) {
						lines.push(`## ${type.name} (${type.kind})`);
						lines.push(`File: ${type.relativePath}:${type.line}`);
						if (type.exported) lines.push("Exported: yes");
						if (type.jsdoc) lines.push(`JSDoc: ${type.jsdoc}`);
						if (type.generics?.length) {
							lines.push(`Generics: <${type.generics.join(", ")}>`);
						}
						lines.push("");
						lines.push("```typescript");
						lines.push(type.signature);
						lines.push("```");

						if (type.usedIn?.length) {
							lines.push("");
							lines.push(`Used in ${type.usedIn.length} file(s):`);
							for (const usage of type.usedIn.slice(0, 10)) {
								lines.push(`  - ${usage.relativePath}:${usage.line}`);
							}
							if (type.usedIn.length > 10) {
								lines.push(`  ... and ${type.usedIn.length - 10} more`);
							}
						}
						lines.push("");
					}

					if (result.totalMatches > result.types.length) {
						lines.push(
							`(${result.totalMatches - result.types.length} more results not shown)`,
						);
					}

					lines.push(`Search time: ${result.searchTimeMs}ms`);
					if (result.indexBuilt) {
						lines.push("(Index was built during this query)");
					}

					return lines.join("\n");
				},
			}),

			list_types: tool({
				description:
					"List all TypeScript type names in the project. Useful for discovering available types or autocomplete suggestions.",
				args: {
					kind: tool.schema
						.array(
							tool.schema.enum([
								"function",
								"type",
								"interface",
								"enum",
								"class",
								"const",
							]),
						)
						.optional()
						.describe("Filter by type kind"),
					limit: tool.schema
						.number()
						.optional()
						.describe("Maximum results to return. Default: 100"),
				},
				async execute(args) {
					const results = typeLookup.listTypeNames({
						kind: args.kind as ExtractedTypeKind[] | undefined,
						limit: args.limit ?? 100,
					});

					if (results.length === 0) {
						return "No types found in the project";
					}

					const stats = typeLookup.getStats();
					const lines: string[] = [];
					lines.push(
						`Found ${stats.totalTypes} types in ${stats.totalFiles} files. Showing ${results.length}:`,
					);
					lines.push("");
					lines.push(results.map((r) => `${r.name} (${r.kind})`).join(", "));

					return lines.join("\n");
				},
			}),
		},

		"tool.execute.before": async (input, output) => {
			if (input.tool === "read" && output.args?.filePath) {
				const filePath = output.args.filePath as string;
				const offset = output.args.offset as number | undefined;
				const limit = output.args.limit as number | undefined;

				currentReads.set(input.callID, { filePath, offset, limit });

				if (config.debug) {
					console.log(
						`\n🔍 [TypeInject] Read tool about to execute for: ${filePath}`,
					);
					if (offset !== undefined || limit !== undefined) {
						console.log(
							`   📍 Line range: offset=${offset ?? 0}, limit=${limit ?? "all"}`,
						);
					}
				}
			}
		},

		"tool.execute.after": async (input, output) => {
			if (input.tool !== "read") {
				return;
			}

			const readContext = currentReads.get(input.callID);
			currentReads.delete(input.callID);

			if (!readContext) {
				if (config.debug) {
					console.log(
						`   ⚠️  No read context found for callID: ${input.callID}`,
					);
				}
				return;
			}

			const { filePath, offset, limit } = readContext;

			if (!isTypeScriptFile(filePath)) {
				if (config.debug) {
					console.log(`   ⏭️  Not a TypeScript file, skipping`);
				}
				return;
			}

			try {
				const originalContent = output.output;

				if (config.budget.skipBarrelFiles && isBarrelFile(originalContent)) {
					if (config.debug) {
						console.log(`   ⏭️  Barrel file detected, skipping injection`);
					}
					return;
				}

				const lineRange =
					offset !== undefined && limit !== undefined
						? { offset, limit }
						: undefined;

				const startTime = Date.now();
				const rawTypes = extractor.extract(filePath, lineRange);
				const extractTime = Date.now() - startTime;

				if (config.debug) {
					console.log(
						`   📊 Extracted ${rawTypes.length} types in ${extractTime}ms`,
					);
				}

				const priorityResult = prioritizeTypes(rawTypes, {
					tokenBudget: config.budget.maxTokens,
					debug: config.debug,
				});
				const types = priorityResult.types;

				if (config.debug && priorityResult.budgetExceeded) {
					console.log(
						`   ⚠️  Budget exceeded: ${priorityResult.excludedCount} types excluded`,
					);
				}

				const injected = formatter.format(originalContent, types, {
					totalTypes: types.length,
					estimatedTokens: priorityResult.totalTokens,
				});

				if (config.debug) {
					console.log(
						`   ✨ Injection complete: ${originalContent.length} -> ${injected.length} bytes (~${priorityResult.totalTokens} tokens)`,
					);
				}

				output.output = injected;
			} catch (error) {
				console.error(`❌ [TypeInject] Error processing ${filePath}:`, error);
			}
		},
	};
};

function isTypeScriptFile(filePath: string): boolean {
	return (
		filePath.endsWith(".ts") ||
		filePath.endsWith(".tsx") ||
		filePath.endsWith(".mts") ||
		filePath.endsWith(".cts")
	);
}
