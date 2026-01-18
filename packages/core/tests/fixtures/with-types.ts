/**
 * User type definition
 */
export type User = {
	id: string;
	name: string;
	email: string;
	age?: number;
};

/**
 * User processing options
 */
export interface ProcessOptions {
	includeMetadata: boolean;
	format: "json" | "xml";
}

/**
 * Processed user with validation status
 */
export type ProcessedUser = User & {
	validated: boolean;
	processedAt: Date;
};

/**
 * Process a user with given options
 */
export function processUser(
	user: User,
	options: ProcessOptions,
): ProcessedUser {
	// Use options to determine validation logic (simplified for demo)
	const validated = options.includeMetadata;

	return {
		...user,
		validated,
		processedAt: new Date(),
	};
}
