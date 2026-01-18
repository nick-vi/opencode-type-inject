/**
 * Used type - appears in the function
 */
export type UsedType = {
	id: string;
	name: string;
};

/**
 * Unused type - never referenced
 */
export type UnusedType = {
	data: string;
	value: number;
};

/**
 * Another used type
 */
export type AnotherUsedType = {
	user: UsedType;
	timestamp: Date;
};

/**
 * Another unused type
 */
export interface UnusedInterface {
	foo: string;
	bar: number;
}

/**
 * This function only uses some types
 */
export function processData(input: UsedType): AnotherUsedType {
	return {
		user: input,
		timestamp: new Date(),
	};
}

/**
 * This function is not in the range we'll read
 */
export function unusedFunction(data: UnusedType): void {
	console.log(data);
}
