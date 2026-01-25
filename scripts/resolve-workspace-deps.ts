#!/usr/bin/env bun

/**
 * Pre-publish script that resolves workspace:* dependencies to actual versions.
 * This is needed because npm publish doesn't understand the workspace: protocol
 */

import { Glob } from "bun";

const rootDir = import.meta.dir + "/..";
const packagesDir = `${rootDir}/packages`;

// Find all package.json files
const glob = new Glob("*/package.json");
const packageJsonPaths: string[] = [];
for await (const path of glob.scan({ cwd: packagesDir, absolute: true })) {
	packageJsonPaths.push(path);
}

// Build a map of package name -> version
const packageVersions = new Map<string, string>();

for (const pkgPath of packageJsonPaths) {
	const pkg = await Bun.file(pkgPath).json();
	if (pkg.name && pkg.version) {
		packageVersions.set(pkg.name, pkg.version);
	}
}

console.log("Package versions found:");
for (const [name, version] of packageVersions) {
	console.log(`  ${name}: ${version}`);
}

// Resolve workspace:* in each package.json
let modified = false;

for (const pkgPath of packageJsonPaths) {
	const pkg = await Bun.file(pkgPath).json();
	let pkgModified = false;

	for (const depType of ["dependencies", "devDependencies", "peerDependencies"] as const) {
		const deps = pkg[depType] as Record<string, string> | undefined;
		if (!deps) continue;

		for (const [depName, depVersion] of Object.entries(deps)) {
			if (depVersion.startsWith("workspace:")) {
				const actualVersion = packageVersions.get(depName);
				if (actualVersion) {
					// workspace:* -> ^version, workspace:^ -> ^version, workspace:~ -> ~version
					let prefix = "^";
					if (depVersion === "workspace:~") {
						prefix = "~";
					}
					const newVersion = `${prefix}${actualVersion}`;
					console.log(`  ${pkg.name}: ${depName} ${depVersion} -> ${newVersion}`);
					deps[depName] = newVersion;
					pkgModified = true;
				} else {
					console.warn(`  Warning: Could not find version for ${depName}`);
				}
			}
		}
	}

	if (pkgModified) {
		await Bun.write(pkgPath, JSON.stringify(pkg, null, "\t") + "\n");
		modified = true;
	}
}

if (modified) {
	console.log("\nWorkspace dependencies resolved.");
} else {
	console.log("\nNo workspace:* dependencies found.");
}
