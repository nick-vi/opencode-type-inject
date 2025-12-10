import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import { TypeLookup } from "../.opencode/plugin/lib/lookup";
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

const projectDir = path.join(import.meta.dir, "..");

describe("TypeLookup", () => {
	test("finds types by exact name", () => {
		const lookup = new TypeLookup(projectDir, testConfig);
		const result = lookup.findType("Config", { exact: true });

		expect(result.found).toBe(true);
		expect(result.types[0]?.name).toBe("Config");
	});

	test("finds types by partial name", () => {
		const lookup = new TypeLookup(projectDir, testConfig);
		const result = lookup.findType("Type", { exact: false, limit: 10 });

		expect(result.found).toBe(true);
		expect(result.totalMatches).toBeGreaterThan(1);
	});

	test("filters by kind", () => {
		const lookup = new TypeLookup(projectDir, testConfig);
		const result = lookup.findType("greet", {
			exact: true,
			kind: ["function"],
		});

		expect(result.found).toBe(true);
		expect(result.types[0]?.kind).toBe("function");
	});

	test("lists all type names", () => {
		const lookup = new TypeLookup(projectDir, testConfig);
		const names = lookup.listTypeNames({ limit: 50 });

		expect(names.length).toBeGreaterThan(0);
		expect(names.length).toBeLessThanOrEqual(50);
	});

	test("returns stats", () => {
		const lookup = new TypeLookup(projectDir, testConfig);
		lookup.findType("Config");
		const stats = lookup.getStats();

		expect(stats.indexed).toBe(true);
		expect(stats.totalTypes).toBeGreaterThan(0);
		expect(stats.totalFiles).toBeGreaterThan(0);
	});
});
