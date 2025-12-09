/**
 * Test nested types, unions, intersections
 */

// Simple union
export type Status = "active" | "inactive" | "pending";

// Union with types
export type Result<T> =
	| { success: true; data: T }
	| { success: false; error: string };

// Intersection
export type UserWithTimestamps = User & {
	createdAt: Date;
	updatedAt: Date;
};

// Nested object
export type Config = {
	database: {
		host: string;
		port: number;
		credentials: {
			username: string;
			password: string;
		};
	};
	api: {
		endpoint: string;
		timeout: number;
	};
};

// Complex generic
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Union of intersections
export type ComplexType =
	| (User & { role: "admin"; permissions: string[] })
	| (User & { role: "user"; quota: number });

export type User = {
	id: string;
	name: string;
};

// Function with complex types
export function processResult<T>(result: Result<T>): T | null {
	return result.success ? result.data : null;
}
