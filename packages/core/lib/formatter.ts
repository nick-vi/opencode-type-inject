import type { Config, ExtractedType } from "./types.ts";

export type FormatStats = {
	totalTypes: number;
	estimatedTokens: number;
	isPartialRead: boolean;
	includeDescription: boolean;
};

const isDev = !import.meta.url.includes("node_modules");

export class ContentFormatter {
	private config: Config;

	constructor(config: Config) {
		this.config = config;
	}

	format(
		originalContent: string,
		types: ExtractedType[],
		stats: FormatStats,
	): string {
		if (types.length === 0) {
			return originalContent;
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

		result += originalContent;

		return result;
	}

	private createHeader(stats: FormatStats): string {
		const devAttr = isDev ? ' src="dev"' : "";
		let header = "";
		if (stats.includeDescription) {
			const context = stats.isPartialRead ? "range" : "file";
			header = `Type definitions referenced in this ${context} but defined elsewhere:\n`;
		}
		return `${header}<types count="${stats.totalTypes}" tokens="~${stats.estimatedTokens}"${devAttr}>\n`;
	}

	private createSeparator(): string {
		return "</types>\n\n";
	}

	private formatType(type: ExtractedType): string {
		let result = "";

		if (type.jsdoc && type.jsdoc.length > 0) {
			result += "/**\n";
			for (const doc of type.jsdoc) {
				const lines = doc.split("\n");
				for (const line of lines) {
					result += ` * ${line}\n`;
				}
			}
			result += " */\n";
		}

		result += type.signature;

		const locationComment = this.formatLocationComment(type);
		if (locationComment) {
			result += locationComment;
		}

		return result;
	}

	formatTypesOnly(types: ExtractedType[], stats: FormatStats): string {
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

	private formatLocationComment(type: ExtractedType): string | null {
		const isFunctionOrClass = type.kind === "function" || type.kind === "class";
		const isTransitive =
			type.importDepth && type.importDepth > 1 && type.sourcePath;

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

		if (isTransitive) {
			return `  // [filePath=${type.sourcePath}]`;
		}

		return null;
	}
}
