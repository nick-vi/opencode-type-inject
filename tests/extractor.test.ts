import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { TypeExtractor } from "../.opencode/plugin/lib/extractor";
import type { Config } from "../.opencode/plugin/lib/types";

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

const rootDir = path.join(import.meta.dir, "..");
const fixturesDir = path.join(import.meta.dir, "fixtures");

describe("TypeExtractor", () => {
	test("extracts functions from simple file", () => {
		const extractor = new TypeExtractor(rootDir, testConfig);
		const types = extractor.extract(path.join(fixturesDir, "simple.ts"));

		const functionNames = types
			.filter((t) => t.kind === "function")
			.map((t) => t.name);
		expect(functionNames).toContain("greet");
		expect(functionNames).toContain("add");
	});

	test("extracts types and interfaces", () => {
		const extractor = new TypeExtractor(rootDir, testConfig);
		const types = extractor.extract(path.join(fixturesDir, "with-types.ts"));

		const typeNames = types
			.filter((t) => t.kind === "type" || t.kind === "interface")
			.map((t) => t.name);
		expect(typeNames.length).toBeGreaterThan(0);
	});

	test("resolves imports up to maxDepth", () => {
		const extractor = new TypeExtractor(rootDir, testConfig);
		const types = extractor.extract(
			path.join(fixturesDir, "depth-test/main.ts"),
		);

		const typeNames = types.map((t) => t.name);
		expect(typeNames).toContain("User");
		expect(typeNames).toContain("Role");
		expect(typeNames).toContain("Permission");
		expect(typeNames).toContain("AuditLog");
	});

	test("includes JSDoc comments", () => {
		const extractor = new TypeExtractor(rootDir, testConfig);
		const types = extractor.extract(path.join(fixturesDir, "simple.ts"));

		const greet = types.find((t) => t.name === "greet");
		expect(greet?.jsdoc).toBeDefined();
		expect(greet?.jsdoc?.length).toBeGreaterThan(0);
	});

	test("extracts line numbers for types", () => {
		const extractor = new TypeExtractor(rootDir, testConfig);
		const types = extractor.extract(path.join(fixturesDir, "simple.ts"));

		const greet = types.find((t) => t.name === "greet");
		expect(greet?.lineStart).toBeDefined();
		expect(greet?.lineEnd).toBeDefined();
		// greet function starts at line 6 (0-based: 5) and ends at line 8 (0-based: 7)
		expect(greet?.lineStart).toBe(5);
		expect(greet?.lineEnd).toBe(7);
	});

	test("extracts explicitly typed arrow functions", () => {
		const extractor = new TypeExtractor(rootDir, testConfig);
		const types = extractor.extract(
			path.join(fixturesDir, "arrow-functions.ts"),
		);

		const functionNames = types
			.filter((t) => t.kind === "function")
			.map((t) => t.name);

		// Should include explicitly typed arrow functions
		expect(functionNames).toContain("processUser");
		expect(functionNames).toContain("myHandler");
		expect(functionNames).toContain("funcExpr");
		expect(functionNames).toContain("regularFunction");

		// Should NOT include non-typed arrow function
		expect(functionNames).not.toContain("double");
	});

	test("arrow functions have correct signatures", () => {
		const extractor = new TypeExtractor(rootDir, testConfig);
		const types = extractor.extract(
			path.join(fixturesDir, "arrow-functions.ts"),
		);

		const processUser = types.find((t) => t.name === "processUser");
		expect(processUser?.signature).toBe(
			"const processUser: (id: string) => string",
		);

		const myHandler = types.find((t) => t.name === "myHandler");
		expect(myHandler?.signature).toBe("const myHandler: Handler");
	});

	test("sets importDepth for imported types", () => {
		const extractor = new TypeExtractor(rootDir, testConfig);
		const types = extractor.extract(
			path.join(fixturesDir, "depth-test/main.ts"),
		);

		// Local type should not have importDepth
		const getUser = types.find((t) => t.name === "getUser");
		expect(getUser?.importDepth).toBeUndefined();

		// Direct import (depth 1)
		const user = types.find((t) => t.name === "User");
		expect(user?.importDepth).toBe(1);

		// Transitive import (depth 2)
		const role = types.find((t) => t.name === "Role");
		expect(role?.importDepth).toBe(2);
	});

	test("sets sourcePath as relative path for imports", () => {
		const extractor = new TypeExtractor(rootDir, testConfig);
		const types = extractor.extract(
			path.join(fixturesDir, "depth-test/main.ts"),
		);

		const user = types.find((t) => t.name === "User");
		expect(user?.sourcePath).toBe("./tests/fixtures/depth-test/user.ts");
	});
});
