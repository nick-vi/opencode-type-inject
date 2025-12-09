import * as path from "node:path";
import {
	Project,
	type SourceFile,
	SyntaxKind,
	VariableDeclarationKind,
} from "ts-morph";
import type { Config, ExtractedTypeKind } from "./types.ts";

type TypeIndexEntry = {
	name: string;
	kind: ExtractedTypeKind;
	filePath: string;
	line: number;
	column: number;
	exported: boolean;
};

export type TypeMatch = {
	name: string;
	kind: ExtractedTypeKind;
	signature: string;
	filePath: string;
	relativePath: string;
	line: number;
	column: number;
	exported: boolean;
	jsdoc?: string;
	generics?: string[];
	usedIn?: UsageInfo[];
};

export type UsageInfo = {
	filePath: string;
	relativePath: string;
	line: number;
	usageType: "import" | "reference";
};

export type LookupOptions = {
	exact?: boolean;
	kind?: ExtractedTypeKind[];
	includeUsages?: boolean;
	limit?: number;
};

export type LookupResult = {
	found: boolean;
	totalMatches: number;
	types: TypeMatch[];
	searchTimeMs: number;
	indexBuilt: boolean;
};

export class TypeLookup {
	private project: Project;
	private directory: string;
	private config: Config;

	private index: Map<string, TypeIndexEntry[]> = new Map();
	private indexed = false;
	private indexedFiles: Set<string> = new Set();

	constructor(directory: string, config: Config) {
		this.directory = directory;
		this.config = config;

		const tsConfigPath = path.join(directory, "tsconfig.json");
		this.project = new Project({
			tsConfigFilePath: tsConfigPath,
			skipAddingFilesFromTsConfig: false,
			compilerOptions: {
				allowJs: true,
			},
		});

		if (this.config.debug) {
			console.log("[TypeLookup] Initialized");
		}
	}

	findType(name: string, options: LookupOptions = {}): LookupResult {
		const startTime = Date.now();
		const { exact = true, kind, includeUsages = false, limit = 5 } = options;

		let indexBuilt = false;
		if (!this.indexed) {
			this.buildIndex();
			indexBuilt = true;
		}

		const matches = this.searchIndex(name, { exact, kind });
		const types: TypeMatch[] = [];
		for (const entry of matches.slice(0, limit)) {
			const fullMatch = this.extractFullInfo(entry, includeUsages);
			if (fullMatch) {
				types.push(fullMatch);
			}
		}

		return {
			found: types.length > 0,
			totalMatches: matches.length,
			types,
			searchTimeMs: Date.now() - startTime,
			indexBuilt,
		};
	}

	listTypeNames(
		options: { kind?: ExtractedTypeKind[]; limit?: number } = {},
	): string[] {
		const { kind, limit = 100 } = options;

		if (!this.indexed) {
			this.buildIndex();
		}

		const names: string[] = [];
		for (const [name, entries] of this.index) {
			if (kind) {
				const hasMatchingKind = entries.some((e) => kind.includes(e.kind));
				if (!hasMatchingKind) continue;
			}
			names.push(name);
			if (names.length >= limit) break;
		}

		return names.sort();
	}

	getStats(): { totalTypes: number; totalFiles: number; indexed: boolean } {
		let totalTypes = 0;
		for (const entries of this.index.values()) {
			totalTypes += entries.length;
		}

		return {
			totalTypes,
			totalFiles: this.indexedFiles.size,
			indexed: this.indexed,
		};
	}

	private buildIndex(): void {
		const startTime = Date.now();
		const sourceFiles = this.project.getSourceFiles();

		if (this.config.debug) {
			console.log(
				`[TypeLookup] Building index from ${sourceFiles.length} files...`,
			);
		}

		for (const sf of sourceFiles) {
			const filePath = sf.getFilePath();

			if (filePath.includes("node_modules")) {
				continue;
			}

			this.indexFile(sf);
		}

		this.indexed = true;

		if (this.config.debug) {
			const stats = this.getStats();
			console.log(
				`[TypeLookup] Index built: ${stats.totalTypes} types in ${stats.totalFiles} files (${Date.now() - startTime}ms)`,
			);
		}
	}

	private indexFile(sourceFile: SourceFile): void {
		const filePath = sourceFile.getFilePath();

		for (const typeAlias of sourceFile.getTypeAliases()) {
			this.addToIndex({
				name: typeAlias.getName(),
				kind: "type",
				filePath,
				line: typeAlias.getStartLineNumber(),
				column: typeAlias.getStart() - typeAlias.getStartLinePos() + 1,
				exported: typeAlias.isExported(),
			});
		}

		for (const iface of sourceFile.getInterfaces()) {
			this.addToIndex({
				name: iface.getName(),
				kind: "interface",
				filePath,
				line: iface.getStartLineNumber(),
				column: iface.getStart() - iface.getStartLinePos() + 1,
				exported: iface.isExported(),
			});
		}

		for (const cls of sourceFile.getClasses()) {
			const name = cls.getName();
			if (!name) continue;

			this.addToIndex({
				name,
				kind: "class",
				filePath,
				line: cls.getStartLineNumber(),
				column: cls.getStart() - cls.getStartLinePos() + 1,
				exported: cls.isExported(),
			});
		}

		for (const enumDecl of sourceFile.getEnums()) {
			this.addToIndex({
				name: enumDecl.getName(),
				kind: "enum",
				filePath,
				line: enumDecl.getStartLineNumber(),
				column: enumDecl.getStart() - enumDecl.getStartLinePos() + 1,
				exported: enumDecl.isExported(),
			});
		}

		for (const func of sourceFile.getFunctions()) {
			const name = func.getName();
			if (!name) continue;

			this.addToIndex({
				name,
				kind: "function",
				filePath,
				line: func.getStartLineNumber(),
				column: func.getStart() - func.getStartLinePos() + 1,
				exported: func.isExported(),
			});
		}

		for (const varDecl of sourceFile.getVariableDeclarations()) {
			const varStatement = varDecl.getVariableStatement();
			if (!varStatement) continue;
			if (varStatement.getDeclarationKind() !== VariableDeclarationKind.Const)
				continue;

			const initializer = varDecl.getInitializer();
			if (!initializer) continue;

			const hasAsConst = initializer.getType().getText().includes("readonly");
			const text = initializer.getText();
			const isFrozen = text.includes("Object.freeze");

			if (!hasAsConst && !isFrozen) continue;

			this.addToIndex({
				name: varDecl.getName(),
				kind: "const",
				filePath,
				line: varDecl.getStartLineNumber(),
				column: varDecl.getStart() - varDecl.getStartLinePos() + 1,
				exported: varStatement.isExported(),
			});
		}

		this.indexedFiles.add(filePath);
	}

	private addToIndex(entry: TypeIndexEntry): void {
		const existing = this.index.get(entry.name) ?? [];
		existing.push(entry);
		this.index.set(entry.name, existing);
	}

	private searchIndex(
		name: string,
		options: { exact?: boolean; kind?: ExtractedTypeKind[] },
	): TypeIndexEntry[] {
		const { exact = true, kind } = options;
		const matches: TypeIndexEntry[] = [];

		if (exact) {
			const entries = this.index.get(name) ?? [];
			matches.push(...entries);
		} else {
			const lowerName = name.toLowerCase();
			for (const [typeName, entries] of this.index) {
				if (typeName.toLowerCase().includes(lowerName)) {
					matches.push(...entries);
				}
			}
		}

		const filtered = kind
			? matches.filter((m) => kind.includes(m.kind))
			: matches;

		return filtered.sort((a, b) => {
			if (a.exported !== b.exported) return a.exported ? -1 : 1;
			const aIsTest =
				a.filePath.includes("/test") || a.filePath.includes(".test.");
			const bIsTest =
				b.filePath.includes("/test") || b.filePath.includes(".test.");
			if (aIsTest !== bIsTest) return aIsTest ? 1 : -1;
			return a.filePath.localeCompare(b.filePath);
		});
	}

	private extractFullInfo(
		entry: TypeIndexEntry,
		includeUsages: boolean,
	): TypeMatch | null {
		const sourceFile = this.project.getSourceFile(entry.filePath);
		if (!sourceFile) return null;

		const relativePath = path.relative(this.directory, entry.filePath);
		let signature = "";
		let jsdoc: string | undefined;
		let generics: string[] | undefined;

		switch (entry.kind) {
			case "type": {
				const typeAlias = sourceFile.getTypeAlias(entry.name);
				if (typeAlias) {
					const typeParams = typeAlias.getTypeParameters();
					const typeParamsText =
						typeParams.length > 0
							? `<${typeParams.map((tp) => tp.getText()).join(", ")}>`
							: "";
					generics =
						typeParams.length > 0
							? typeParams.map((tp) => tp.getName())
							: undefined;

					const typeText = typeAlias.getType().getText(typeAlias);
					signature = `type ${entry.name}${typeParamsText} = ${typeText}`;
					const docs = typeAlias.getJsDocs();
					if (docs.length > 0) {
						jsdoc = docs.map((d) => d.getDescription().trim()).join("\n");
					}
				}
				break;
			}
			case "interface": {
				const iface = sourceFile.getInterface(entry.name);
				if (iface) {
					const typeParams = iface.getTypeParameters();
					const typeParamsText =
						typeParams.length > 0
							? `<${typeParams.map((tp) => tp.getText()).join(", ")}>`
							: "";
					generics =
						typeParams.length > 0
							? typeParams.map((tp) => tp.getName())
							: undefined;
					const extendsTypes = iface.getExtends();
					const extendsText =
						extendsTypes.length > 0
							? ` extends ${extendsTypes.map((e) => e.getText()).join(", ")}`
							: "";
					const properties = iface.getProperties().map((prop) => {
						const propName = prop.getName();
						const propType = prop.getType().getText(prop);
						const isOptional = prop.hasQuestionToken();
						const readonly = prop.isReadonly() ? "readonly " : "";
						return `  ${readonly}${propName}${isOptional ? "?" : ""}: ${propType};`;
					});

					const methods = iface.getMethods().map((method) => {
						const methodName = method.getName();
						const methodTypeParams = method.getTypeParameters();
						const methodTypeParamsText =
							methodTypeParams.length > 0
								? `<${methodTypeParams.map((tp) => tp.getText()).join(", ")}>`
								: "";

						const params = method
							.getParameters()
							.map((p) => {
								const paramName = p.getName();
								const paramType = p.getType().getText(p);
								const isOptional = p.isOptional();
								return `${paramName}${isOptional ? "?" : ""}: ${paramType}`;
							})
							.join(", ");

						const returnType = method.getReturnType().getText(method);
						return `  ${methodName}${methodTypeParamsText}(${params}): ${returnType};`;
					});

					const members = [...properties, ...methods].join("\n");
					signature = `interface ${entry.name}${typeParamsText}${extendsText} {\n${members}\n}`;
					const docs = iface.getJsDocs();
					if (docs.length > 0) {
						jsdoc = docs.map((d) => d.getDescription().trim()).join("\n");
					}
				}
				break;
			}
			case "class": {
				const cls = sourceFile.getClass(entry.name);
				if (cls) {
					const typeParams = cls.getTypeParameters();
					const typeParamsText =
						typeParams.length > 0
							? `<${typeParams.map((tp) => tp.getText()).join(", ")}>`
							: "";
					generics =
						typeParams.length > 0
							? typeParams.map((tp) => tp.getName())
							: undefined;
					const extendsClause = cls.getExtends();
					const extendsText = extendsClause
						? ` extends ${extendsClause.getText()}`
						: "";
					const implementsClause = cls.getImplements();
					const implementsText =
						implementsClause.length > 0
							? ` implements ${implementsClause.map((i) => i.getText()).join(", ")}`
							: "";

					const isAbstract = cls.isAbstract() ? "abstract " : "";
					const properties = cls
						.getProperties()
						.filter((p) => !p.hasModifier(SyntaxKind.PrivateKeyword))
						.map((prop) => {
							const propName = prop.getName();
							const propType = prop.getType().getText(prop);
							const isOptional = prop.hasQuestionToken();
							const readonly = prop.isReadonly() ? "readonly " : "";
							const isStatic = prop.isStatic() ? "static " : "";
							return `  ${isStatic}${readonly}${propName}${isOptional ? "?" : ""}: ${propType};`;
						});

					const methods = cls
						.getMethods()
						.filter((m) => !m.hasModifier(SyntaxKind.PrivateKeyword))
						.map((method) => {
							const methodName = method.getName();
							const isStatic = method.isStatic() ? "static " : "";
							const isAbstract = method.isAbstract() ? "abstract " : "";

							const params = method
								.getParameters()
								.map((p) => {
									const paramName = p.getName();
									const paramType = p.getType().getText(p);
									const isOptional = p.isOptional();
									return `${paramName}${isOptional ? "?" : ""}: ${paramType}`;
								})
								.join(", ");

							const returnType = method.getReturnType().getText(method);
							return `  ${isStatic}${isAbstract}${methodName}(${params}): ${returnType};`;
						});

					const members = [...properties, ...methods].join("\n");
					signature = `${isAbstract}class ${entry.name}${typeParamsText}${extendsText}${implementsText} {\n${members}\n}`;
					const docs = cls.getJsDocs();
					if (docs.length > 0) {
						jsdoc = docs.map((d) => d.getDescription().trim()).join("\n");
					}
				}
				break;
			}
			case "enum": {
				const enumDecl = sourceFile.getEnum(entry.name);
				if (enumDecl) {
					const isConst = enumDecl.isConstEnum() ? "const " : "";

					const members = enumDecl
						.getMembers()
						.map((member) => {
							const memberName = member.getName();
							const value = member.getValue();
							if (value !== undefined) {
								const valueStr =
									typeof value === "string" ? `"${value}"` : value;
								return `  ${memberName} = ${valueStr},`;
							}
							return `  ${memberName},`;
						})
						.join("\n");

					signature = `${isConst}enum ${entry.name} {\n${members}\n}`;
					const docs = enumDecl.getJsDocs();
					if (docs.length > 0) {
						jsdoc = docs.map((d) => d.getDescription().trim()).join("\n");
					}
				}
				break;
			}
			case "function": {
				const func = sourceFile.getFunction(entry.name);
				if (func) {
					const typeParams = func.getTypeParameters();
					const typeParamsText =
						typeParams.length > 0
							? `<${typeParams.map((tp) => tp.getText()).join(", ")}>`
							: "";
					generics =
						typeParams.length > 0
							? typeParams.map((tp) => tp.getName())
							: undefined;
					const params = func
						.getParameters()
						.map((p) => {
							const paramName = p.getName();
							const paramType = p.getType().getText(p);
							const isOptional = p.isOptional();
							const hasInitializer = p.hasInitializer();
							return `${paramName}${isOptional || hasInitializer ? "?" : ""}: ${paramType}`;
						})
						.join(", ");

					const returnType = func.getReturnType().getText(func);
					signature = `function ${entry.name}${typeParamsText}(${params}): ${returnType}`;
					const docs = func.getJsDocs();
					if (docs.length > 0) {
						jsdoc = docs.map((d) => d.getDescription().trim()).join("\n");
					}
				}
				break;
			}
			case "const": {
				const varDecl = sourceFile.getVariableDeclaration(entry.name);
				if (varDecl) {
					const type = varDecl.getType().getText(varDecl);
					const initializer = varDecl.getInitializer();
					const text = initializer?.getText() ?? "";
					if (
						text.length < 200 &&
						(text.startsWith("{") || text.startsWith("["))
					) {
						signature = `const ${entry.name}: ${type} = ${text}`;
					} else {
						signature = `const ${entry.name}: ${type}`;
					}
					const varStatement = varDecl.getVariableStatement();
					if (varStatement) {
						const docs = varStatement.getJsDocs();
						if (docs.length > 0) {
							jsdoc = docs.map((d) => d.getDescription().trim()).join("\n");
						}
					}
				}
				break;
			}
		}

		if (!signature) {
			return null;
		}

		const match: TypeMatch = {
			name: entry.name,
			kind: entry.kind,
			signature,
			filePath: entry.filePath,
			relativePath,
			line: entry.line,
			column: entry.column,
			exported: entry.exported,
		};

		if (jsdoc) match.jsdoc = jsdoc;
		if (generics?.length) match.generics = generics;

		if (includeUsages) {
			match.usedIn = this.findUsages(entry);
		}

		return match;
	}

	private findUsages(entry: TypeIndexEntry): UsageInfo[] {
		const usages: UsageInfo[] = [];

		for (const sf of this.project.getSourceFiles()) {
			const filePath = sf.getFilePath();
			if (filePath === entry.filePath) continue;
			if (filePath.includes("node_modules")) continue;

			for (const importDecl of sf.getImportDeclarations()) {
				const namedImports = importDecl.getNamedImports();
				for (const ni of namedImports) {
					if (ni.getName() === entry.name) {
						usages.push({
							filePath,
							relativePath: path.relative(this.directory, filePath),
							line: ni.getStartLineNumber(),
							usageType: "import",
						});
					}
				}
			}
		}

		return usages;
	}

	invalidate(filePath: string): void {
		if (!this.indexedFiles.has(filePath)) return;

		for (const [name, entries] of this.index) {
			const filtered = entries.filter((e) => e.filePath !== filePath);
			if (filtered.length === 0) {
				this.index.delete(name);
			} else {
				this.index.set(name, filtered);
			}
		}

		this.indexedFiles.delete(filePath);

		try {
			const sf = this.project.getSourceFile(filePath);
			if (sf) {
				this.project.removeSourceFile(sf);
			}
			const newSf = this.project.addSourceFileAtPath(filePath);
			this.indexFile(newSf);
		} catch {
			// File may not exist
		}
	}

	rebuildIndex(): void {
		this.index.clear();
		this.indexedFiles.clear();
		this.indexed = false;
		this.buildIndex();
	}
}
