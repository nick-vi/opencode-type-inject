#!/usr/bin/env node
import {
	ContentFormatter,
	defaultConfig,
	prioritizeTypes,
	TypeExtractor,
} from "@nick-vi/type-inject-core";

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
	chunks.push(chunk);
}
const input = JSON.parse(Buffer.concat(chunks).toString());
const { tool_input } = input;

if (!tool_input) {
	process.exit(0);
}

const filePath = tool_input.file_path;
if (!filePath?.match(/\.(ts|tsx|mts|cts|svelte)$/)) {
	process.exit(0);
}

const offset = tool_input.offset as number | undefined;
const limit = tool_input.limit as number | undefined;
const lineRange =
	offset !== undefined && limit !== undefined ? { offset, limit } : undefined;

try {
	const cwd = process.cwd();
	const extractor = new TypeExtractor(cwd, defaultConfig);
	const formatter = new ContentFormatter(defaultConfig);

	const rawTypes = extractor.extract(filePath, lineRange);
	const { types, totalTokens } = prioritizeTypes(rawTypes, {
		tokenBudget: defaultConfig.budget.maxTokens,
		debug: false,
	});

	if (types.length === 0) {
		process.exit(0);
	}

	const formatted = formatter.formatTypesOnly(types, {
		totalTypes: types.length,
		estimatedTokens: totalTokens,
	});

	console.log(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: "PostToolUse",
				additionalContext: formatted,
			},
		}),
	);
} catch {
	// Fail silently
	process.exit(0);
}
