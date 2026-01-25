import { describe, expect, test } from "bun:test";
import {
	type Config,
	ContentFormatter,
	type ExtractedType,
} from "../lib/index.ts";

const testConfig: Config = {
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
	format: { includeMarkers: true },
	imports: { enabled: true, maxDepth: 4, includeTypeOnly: true },
	filtering: { onlyUsed: true, includeTransitive: true },
	budget: { maxTokens: 1500, skipBarrelFiles: true },
};

describe("ContentFormatter", () => {
	test("adds location comment for function types", () => {
		const formatter = new ContentFormatter(testConfig);

		const types: ExtractedType[] = [
			{
				kind: "function",
				name: "processUser",
				signature: "function processUser(id: string): User",
				exported: true,
				lineStart: 10,
				lineEnd: 25,
			},
		];

		const result = formatter.format("// original content", types, {
			totalTypes: types.length,
			estimatedTokens: 100,
			isPartialRead: false,
			includeDescription: false,
		});

		// Should contain the location comment
		expect(result).toContain("// [offset=10,limit=16]");
	});

	test("adds location comment for class types", () => {
		const formatter = new ContentFormatter(testConfig);

		const types: ExtractedType[] = [
			{
				kind: "class",
				name: "UserService",
				signature: "class UserService { ... }",
				exported: true,
				lineStart: 5,
				lineEnd: 50,
			},
		];

		const result = formatter.format("// original content", types, {
			totalTypes: types.length,
			estimatedTokens: 100,
			isPartialRead: false,
			includeDescription: false,
		});

		// Should contain the location comment
		expect(result).toContain("// [offset=5,limit=46]");
	});

	test("does not add location comment for local type aliases", () => {
		const formatter = new ContentFormatter(testConfig);

		const types: ExtractedType[] = [
			{
				kind: "type",
				name: "User",
				signature: "type User = { id: string; name: string; }",
				exported: true,
				lineStart: 1,
				lineEnd: 1,
			},
		];

		const result = formatter.format("// original content", types, {
			totalTypes: types.length,
			estimatedTokens: 100,
			isPartialRead: false,
			includeDescription: false,
		});

		// Should NOT contain location comment for local types
		expect(result).not.toContain("[offset=");
		expect(result).not.toContain("[filePath=");
	});

	test("adds filePath-only comment for transitive type aliases", () => {
		const formatter = new ContentFormatter(testConfig);

		const types: ExtractedType[] = [
			{
				kind: "type",
				name: "Permission",
				signature: "type Permission = { action: string; resource: string; }",
				exported: true,
				lineStart: 10,
				lineEnd: 12,
				sourcePath: "lib/permission.ts",
				importDepth: 2,
			},
		];

		const result = formatter.format("// original content", types, {
			totalTypes: types.length,
			estimatedTokens: 100,
			isPartialRead: false,
			includeDescription: false,
		});

		// Should contain filePath only (no offset/limit for types)
		expect(result).toContain("// [filePath=lib/permission.ts]");
		expect(result).not.toContain("offset=");
	});

	test("includes filePath for transitive imports (depth > 1)", () => {
		const formatter = new ContentFormatter(testConfig);

		const types: ExtractedType[] = [
			{
				kind: "function",
				name: "helper",
				signature: "function helper(): void",
				exported: true,
				lineStart: 20,
				lineEnd: 30,
				sourcePath: "lib/utils/helper.ts",
				importDepth: 2,
			},
		];

		const result = formatter.format("// original content", types, {
			totalTypes: types.length,
			estimatedTokens: 100,
			isPartialRead: false,
			includeDescription: false,
		});

		// Should contain filePath for transitive import
		expect(result).toContain(
			"// [filePath=lib/utils/helper.ts,offset=20,limit=11]",
		);
	});

	test("does not include filePath for direct imports (depth = 1)", () => {
		const formatter = new ContentFormatter(testConfig);

		const types: ExtractedType[] = [
			{
				kind: "function",
				name: "directImport",
				signature: "function directImport(): void",
				exported: true,
				lineStart: 5,
				lineEnd: 10,
				sourcePath: "lib/direct.ts",
				importDepth: 1,
			},
		];

		const result = formatter.format("// original content", types, {
			totalTypes: types.length,
			estimatedTokens: 100,
			isPartialRead: false,
			includeDescription: false,
		});

		// Should NOT contain filePath for direct import
		expect(result).not.toContain("filePath=");
		expect(result).toContain("// [offset=5,limit=6]");
	});

	test("handles types without line info gracefully", () => {
		const formatter = new ContentFormatter(testConfig);

		const types: ExtractedType[] = [
			{
				kind: "function",
				name: "noLineInfo",
				signature: "function noLineInfo(): void",
				exported: true,
				// No lineStart/lineEnd
			},
		];

		const result = formatter.format("// original content", types, {
			totalTypes: types.length,
			estimatedTokens: 100,
			isPartialRead: false,
			includeDescription: false,
		});

		// Should not crash, should not add location comment
		expect(result).toContain("function noLineInfo(): void");
		expect(result).not.toContain("[offset=");
	});
});
