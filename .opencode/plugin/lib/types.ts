/**
 * Type definitions for the OpenCode Type Injection Plugin
 */

export type ExtractedTypeKind =
	| "function"
	| "type"
	| "interface"
	| "enum"
	| "const"
	| "class";

export type ExtractedType = {
	kind: ExtractedTypeKind;
	name: string;
	signature: string;
	jsdoc?: string[];
	exported: boolean;
	/** Source file path (for import resolution tracking) */
	sourcePath?: string;
	/** Whether this type is actually used in the file */
	isUsed?: boolean;
};

export type Config = {
	enabled: boolean;
	debug: boolean;
	includeJSDoc: boolean;
	inject: {
		functions: boolean;
		types: boolean;
		interfaces: boolean;
		enums: boolean;
		classes: boolean;
		constants: boolean;
	};
	format: {
		includeMarkers: boolean;
	};
	imports: {
		enabled: boolean;
		maxDepth: number;
		includeTypeOnly: boolean;
	};
	filtering: {
		onlyUsed: boolean;
		includeTransitive: boolean;
	};
	budget: {
		maxTokens: number;
		skipBarrelFiles: boolean;
	};
};
