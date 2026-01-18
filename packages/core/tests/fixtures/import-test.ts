// Test file for import resolution
import type { AnotherUsedType, UsedType } from "./complex";

export function doSomething(input: UsedType): AnotherUsedType {
	return {
		user: input,
		timestamp: new Date(),
	};
}
