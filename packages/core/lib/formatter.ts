import type { Config, ExtractedType } from "./types.ts";

export type FormatStats = {
	totalTypes: number;
	estimatedTokens: number;
};

const isDev = !import.meta.url.includes("node_modules");

export class ContentFormatter {
	private config: Config;

	constructor(config: Config) {
		this.config = config;
	}

	/**
	 * Format the original content with injected type signatures
	 * @param stats Optional stats to include in the output
	 */
	format(
		originalContent: string,
		types: ExtractedType[],
		stats?: FormatStats,
	): string {
		// If no types extracted, return original content
		if (types.length === 0) {
			if (this.config.debug) {
				console.log(
					"[TypeInject] No types to inject, returning original content",
				);
			}
			return originalContent;
		}

		let result = "";

		// Add header marker with stats
		if (this.config.format.includeMarkers) {
			result += this.createHeader(stats);
		}

		// Add extracted types
		for (const type of types) {
			result += this.formatType(type);
			result += "\n\n";
		}

		// Add separator
		if (this.config.format.includeMarkers) {
			result += this.createSeparator();
		}

		// Add original content
		result += originalContent;

		if (this.config.debug) {
			console.log(
				`[TypeInject] Formatted content: ${originalContent.length} -> ${result.length} bytes (+${result.length - originalContent.length})`,
			);
		}

		return result;
	}

	/**
	 * Create header marker with optional stats as attributes
	 */
	private createHeader(stats?: FormatStats): string {
		const devAttr = isDev ? ' src="dev"' : "";
		if (stats) {
			return `<types count="${stats.totalTypes}" tokens="~${stats.estimatedTokens}"${devAttr}>\n`;
		}
		return `<types${devAttr}>\n`;
	}

	/**
	 * Create separator between injected and original content
	 */
	private createSeparator(): string {
		return "</types>\n\n";
	}

	/**
	 * Format a single extracted type
	 */
	private formatType(type: ExtractedType): string {
		let result = "";

		// Add JSDoc comment if present
		if (type.jsdoc && type.jsdoc.length > 0) {
			result += "/**\n";
			for (const doc of type.jsdoc) {
				// Split multi-line JSDoc
				const lines = doc.split("\n");
				for (const line of lines) {
					result += ` * ${line}\n`;
				}
			}
			result += " */\n";
		}

		// Add the signature WITHOUT export keyword to save tokens
		result += type.signature;

		// Add location comment for function/class types (where we show signature, not full impl)
		const locationComment = this.formatLocationComment(type);
		if (locationComment) {
			result += locationComment;
		}

		return result;
	}

	/**
	 * Format types only (without prepending to content)
	 * Useful for hooks that inject types as additional context
	 */
	formatTypesOnly(types: ExtractedType[], stats?: FormatStats): string {
		if (types.length === 0) {
			return "";
		}

		let result = "";

		if (this.config.format.includeMarkers) {
			result += this.createHeader(stats);
		}

		for (const type of types) {
			result += this.formatType(type);
			result += "\n\n";
		}

		if (this.config.format.includeMarkers) {
			result += this.createSeparator();
		}

		return result.trim();
	}

	/**
	 * Format location comment for types
	 * - function/class: full location (offset/limit) to read implementation
	 * - transitive types (depth > 1): just filePath for navigation/refactoring
	 */
	private formatLocationComment(type: ExtractedType): string | null {
		const isFunctionOrClass = type.kind === "function" || type.kind === "class";
		const isTransitive =
			type.importDepth && type.importDepth > 1 && type.sourcePath;

		// For function/class: show offset/limit to read implementation
		if (isFunctionOrClass) {
			if (type.lineStart === undefined || type.lineEnd === undefined) {
				return null;
			}

			const limit = type.lineEnd - type.lineStart + 1;

			if (isTransitive) {
				return `  // [filePath=${type.sourcePath},offset=${type.lineStart},limit=${limit}]`;
			}

			return `  // [offset=${type.lineStart},limit=${limit}]`;
		}

		// For other transitive types: just show filePath for navigation
		if (isTransitive) {
			return `  // [filePath=${type.sourcePath}]`;
		}

		return null;
	}
}
