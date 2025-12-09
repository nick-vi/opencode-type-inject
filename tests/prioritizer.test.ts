import { describe, expect, test } from "bun:test";
import {
	isBarrelFile,
	prioritizeTypes,
} from "../.opencode/plugin/lib/prioritizer";
import type { ExtractedType } from "../.opencode/plugin/lib/types";

describe("prioritizeTypes", () => {
	test("always includes functions (tier 1)", () => {
		const types: ExtractedType[] = [
			{
				kind: "function",
				name: "myFunc",
				signature: "function myFunc(): void",
				exported: true,
			},
			{
				kind: "type",
				name: "MyType",
				signature: "type MyType = string",
				exported: true,
			},
		];

		const result = prioritizeTypes(types, { tokenBudget: 10, debug: false });
		const names = result.types.map((t) => t.name);

		expect(names).toContain("myFunc");
	});

	test("respects token budget", () => {
		const types: ExtractedType[] = Array.from({ length: 100 }, (_, i) => ({
			kind: "type" as const,
			name: `Type${i}`,
			signature: `type Type${i} = { field: string; anotherField: number; }`,
			exported: true,
		}));

		const result = prioritizeTypes(types, { tokenBudget: 100, debug: false });

		expect(result.types.length).toBeLessThan(100);
		expect(result.budgetExceeded).toBe(true);
	});

	test("prioritizes types used in function signatures", () => {
		const types: ExtractedType[] = [
			{
				kind: "function",
				name: "getUser",
				signature: "function getUser(): User",
				exported: true,
			},
			{
				kind: "type",
				name: "User",
				signature: "type User = { id: string }",
				exported: true,
			},
			{
				kind: "type",
				name: "Unused",
				signature: "type Unused = { x: number }",
				exported: true,
			},
		];

		const result = prioritizeTypes(types, { tokenBudget: 500, debug: false });

		expect(result.tierCounts.tier1).toBe(1);
		expect(result.tierCounts.tier2).toBe(1);
	});
});

describe("isBarrelFile", () => {
	test("detects barrel files with export *", () => {
		const content = `export * from './Button';
export * from './Modal';`;

		expect(isBarrelFile(content)).toBe(true);
	});

	test("detects barrel files with named exports", () => {
		const content = `export { Button } from './Button';
export { Modal } from './Modal';`;

		expect(isBarrelFile(content)).toBe(true);
	});

	test("returns false for files with actual code", () => {
		const content = `export function greet() { return 'hello'; }`;

		expect(isBarrelFile(content)).toBe(false);
	});
});
