import { Project } from "ts-morph";

export type Diagnostic = {
	file: string;
	line: number;
	col: number;
	message: string;
	code: number;
};

export type CheckResult = {
	success: boolean;
	diagnostics: Diagnostic[];
};

export function getProjectDiagnostics(
	tsconfigPath: string,
	filePath?: string,
): CheckResult {
	try {
		const project = new Project({
			tsConfigFilePath: tsconfigPath,
			skipAddingFilesFromTsConfig: false,
		});

		const preEmitDiagnostics = project.getPreEmitDiagnostics();
		const diagnostics: Diagnostic[] = [];

		for (const diagnostic of preEmitDiagnostics) {
			const sourceFile = diagnostic.getSourceFile();
			if (!sourceFile) continue;

			const fileDiagPath = sourceFile.getFilePath();

			if (
				filePath &&
				!fileDiagPath.endsWith(filePath) &&
				fileDiagPath !== filePath
			) {
				continue;
			}

			const start = diagnostic.getStart();
			const lineAndCol = sourceFile.getLineAndColumnAtPos(start ?? 0);

			diagnostics.push({
				file: fileDiagPath,
				line: lineAndCol.line,
				col: lineAndCol.column,
				message: diagnostic.getMessageText().toString(),
				code: diagnostic.getCode(),
			});
		}

		return {
			success: diagnostics.length === 0,
			diagnostics,
		};
	} catch {
		return {
			success: true,
			diagnostics: [],
		};
	}
}

export function formatDiagnostics(
	diagnostics: Diagnostic[],
	cwd: string,
	options: {
		modifiedFile?: string;
		maxFileErrors?: number;
		maxProjectFiles?: number;
	} = {},
): string {
	const { modifiedFile, maxFileErrors = 20, maxProjectFiles = 5 } = options;

	if (diagnostics.length === 0) {
		return "";
	}

	const fileErrors = modifiedFile
		? diagnostics.filter(
				(d) => d.file === modifiedFile || d.file.endsWith(modifiedFile),
			)
		: [];
	const otherErrors = modifiedFile
		? diagnostics.filter(
				(d) => d.file !== modifiedFile && !d.file.endsWith(modifiedFile),
			)
		: diagnostics;

	const lines: string[] = [];

	if (fileErrors.length > 0) {
		lines.push("TypeScript errors in the file you just wrote:");
		lines.push("<file_diagnostics>");
		for (const err of fileErrors.slice(0, maxFileErrors)) {
			lines.push(`ERROR [${err.line}:${err.col}] ${err.message}`);
		}
		if (fileErrors.length > maxFileErrors) {
			lines.push(`... and ${fileErrors.length - maxFileErrors} more`);
		}
		lines.push("</file_diagnostics>");
	}

	if (otherErrors.length > 0) {
		lines.push("TypeScript errors in other files caused by this change:");
		lines.push("<project_diagnostics>");

		const byFile = new Map<string, Diagnostic[]>();
		for (const err of otherErrors) {
			const existing = byFile.get(err.file) || [];
			existing.push(err);
			byFile.set(err.file, existing);
		}

		let fileCount = 0;
		for (const [file, errors] of byFile) {
			if (fileCount >= maxProjectFiles) {
				lines.push(
					`... and ${byFile.size - maxProjectFiles} more files with errors`,
				);
				break;
			}

			const relativePath = file.startsWith(cwd)
				? file.slice(cwd.length + 1)
				: file;

			lines.push(relativePath);
			for (const err of errors.slice(0, 5)) {
				lines.push(`  ERROR [${err.line}:${err.col}] ${err.message}`);
			}
			if (errors.length > 5) {
				lines.push(`  ... and ${errors.length - 5} more`);
			}
			fileCount++;
		}
		lines.push("</project_diagnostics>");
	}

	return lines.join("\n");
}
