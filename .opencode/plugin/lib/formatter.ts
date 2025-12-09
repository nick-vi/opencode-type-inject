import type { Config, ExtractedType } from "./types.ts";

export type FormatStats = {
	totalTypes: number;
	estimatedTokens: number;
};

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
		if (stats) {
			return `<types count="${stats.totalTypes}" tokens="~${stats.estimatedTokens}">\n`;
		}
		return "<types>\n";
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

		return result;
	}
}
