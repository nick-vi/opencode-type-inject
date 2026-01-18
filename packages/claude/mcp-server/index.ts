import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
	TypeLookup,
	defaultConfig,
} from "@nick-vi/type-inject-core";

const cwd = process.cwd();
let typeLookup: TypeLookup | null = null;

function getTypeLookup(): TypeLookup {
	if (!typeLookup) {
		typeLookup = new TypeLookup(cwd, defaultConfig);
	}
	return typeLookup;
}

const server = new McpServer({
	name: "type-inject",
	version: "0.1.0",
});

const kindEnum = z.enum(["function", "type", "interface", "enum", "class", "const"]);

server.registerTool(
	"lookup_type",
	{
		title: "Lookup Type",
		description: "Look up TypeScript type definitions by name. Returns the full type signature, file location, and optionally where it's used.",
		inputSchema: {
			name: z.string(),
			exact: z.boolean().optional(),
			kind: z.array(kindEnum).optional(),
			includeUsages: z.boolean().optional(),
			limit: z.number().optional(),
		},
	},
	async ({ name, exact, kind, includeUsages, limit }) => {
		const lookup = getTypeLookup();
		const result = lookup.findType(name, {
			exact: exact ?? true,
			kind: kind,
			includeUsages: includeUsages ?? false,
			limit: limit ?? 5,
		});

		if (!result.found) {
			return { content: [{ type: "text", text: `No types found matching "${name}"` }] };
		}

		const lines: string[] = [];
		lines.push(`Found ${result.totalMatches} type(s) matching "${name}" (showing ${result.types.length}):`);
		lines.push("");

		for (const type of result.types) {
			lines.push(`## ${type.name} (${type.kind})`);
			const offset = type.line - 1;
			const lineLimit = type.lineEnd - type.line + 1;
			lines.push(`File: ${type.relativePath} [offset=${offset},limit=${lineLimit}]`);
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
			lines.push(`(${result.totalMatches - result.types.length} more results not shown)`);
		}

		lines.push(`Search time: ${result.searchTimeMs}ms`);
		if (result.indexBuilt) {
			lines.push("(Index was built during this query)");
		}

		return { content: [{ type: "text", text: lines.join("\n") }] };
	},
);

server.registerTool(
	"list_types",
	{
		title: "List Types",
		description: "List all TypeScript type names in the project. Useful for discovering available types.",
		inputSchema: {
			kind: z.array(kindEnum).optional(),
			limit: z.number().optional(),
		},
	},
	async ({ kind, limit }) => {
		const lookup = getTypeLookup();
		const results = lookup.listTypeNames({
			kind: kind,
			limit: limit ?? 100,
		});

		if (results.length === 0) {
			return { content: [{ type: "text", text: "No types found in the project" }] };
		}

		const stats = lookup.getStats();
		const lines: string[] = [];
		lines.push(`Found ${stats.totalTypes} types in ${stats.totalFiles} files. Showing ${results.length}:`);
		lines.push("");
		lines.push(results.map((r) => `${r.name} (${r.kind})`).join(", "));

		return { content: [{ type: "text", text: lines.join("\n") }] };
	},
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);
