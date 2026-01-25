---
"@nick-vi/type-inject-core": patch
"@nick-vi/type-inject-mcp": patch
"@nick-vi/opencode-type-inject": patch
---

type_check now finds nearest tsconfig.json for better monorepo support

When checking a specific file, type_check now searches for the nearest tsconfig.json starting from the file's directory, enabling proper path alias resolution in monorepos.
