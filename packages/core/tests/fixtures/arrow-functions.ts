/**
 * Explicitly typed arrow function - should be extracted
 */
export const processUser: (id: string) => string = (id) => {
	return `User: ${id}`;
};

/**
 * Type alias for handler function
 */
export type Handler = (input: string) => number;

/**
 * Arrow function with type alias - should be extracted
 */
export const myHandler: Handler = (input) => {
	return input.length;
};

// NOT explicitly typed - should NOT be extracted
export const double = (n: number) => n * 2;

// Regular function - should be extracted
export function regularFunction(x: number): number {
	return x * 2;
}

/**
 * Explicitly typed function expression - should be extracted
 */
export const funcExpr: (a: number, b: number) => number = (a, b) => a + b;
