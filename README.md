# opencode-type-inject

OpenCode plugin that auto-injects TypeScript types into file reads and provides type lookup tools.

## Installation

Add to your `opencode.json`:

```json
{
  "plugin": ["@nick-vi/opencode-type-inject"]
}
```

## What It Does

### Automatic Type Injection (Read Hook)

When an LLM reads a TypeScript or Svelte file, this plugin automatically:

1. Extracts type signatures (functions, types, interfaces, enums, classes, constants)
2. Resolves imported types from other files (up to 4 levels deep)
3. Applies smart filtering (only types actually used in the code)
4. Enforces a token budget with priority-based ordering
5. Prepends the signatures to the file content

### Custom Tools

The plugin also provides two tools:

- **`lookup_type`** - Look up any type by name without reading files
- **`list_types`** - List all types in the project

## Example Output

When reading a file:

```typescript
<types count="3" tokens="~85">
function getUser(id: string): User  // [offset=2,limit=8]

type User = { id: string; name: string; role: Role; }

type Role = { name: string; permissions: Permission[]; }  // [filePath=./lib/role.ts]

</types>

<file>
00001| import { User } from "./user";
00002| 
00003| export function getUser(id: string): User {
00004|   return { id, name: "test", role: { name: "admin", permissions: [] } };
00005| }
</file>
```

## Key Features

### Token Budget with Priority Ordering

Types are prioritized by importance:

| Tier | Contents | Priority |
|------|----------|----------|
| 1 | Function signatures | ALWAYS included |
| 2 | Types used in function signatures | High |
| 3 | Dependencies of tier 2 types | Medium |
| 4 | Other local types | Low |
| 5 | Imported types not yet included | Lowest |

### Import Resolution

Types are automatically resolved from imported files up to 4 levels deep.

### Smart Filtering

Only types actually used in the code are included. For partial file reads (with offset/limit), only types relevant to that section are injected.

### Barrel File Detection

Files that only contain `export * from` statements are skipped.

### Svelte Support

Svelte files (`.svelte`) are fully supported:

- Extracts types from both `<script lang="ts">` (instance) and `<script module lang="ts">` (module) blocks
- Resolves imports between Svelte and TypeScript files in any direction (TS → Svelte, Svelte → TS)
- Calculates correct line numbers for each script block
- Requires `svelte` as an optional peer dependency (only loaded if installed)

## Understanding the Output

### What Gets Shown

| What | Shown As | Why |
|------|----------|-----|
| Functions | Signature only | Implementation can be long; signature tells you how to call it |
| Classes | Public members only | Private details are internal; public API is what matters |
| Types/Interfaces | Full definition | They ARE the definition - nothing hidden |
| Arrow functions | Only if explicitly typed | `const fn: Type = ...` is intentional API; `const fn = () => {}` is often implementation detail |

### Location Comments

Since functions and classes only show signatures, we provide location hints so you can read the implementation when needed:

```typescript
function processUser(id: string): User  // [offset=15,limit=28]
```

The format matches the `read` tool parameters directly - no translation needed.

### When filePath is Included

```typescript
// Direct import - you can see the import statement above
type User = { ... }

// Transitive import (2+ levels deep) - source not obvious
type Permission = { ... }  // [filePath=./lib/permission.ts]
```

Direct imports are visible in the file's import statements. Transitive imports aren't - so we include where they live for navigation and refactoring.

| Type | Local/Direct Import | Transitive Import (depth > 1) |
|------|---------------------|-------------------------------|
| function/class | `// [offset=X,limit=Y]` | `// [filePath=...,offset=X,limit=Y]` |
| type/interface/enum | (none - full definition shown) | `// [filePath=...]` |

## Tools

### `lookup_type`

Look up TypeScript type definitions by name.

**Arguments:**
- `name` (required): Type name to search for
- `exact` (optional): Exact match or contains. Default: true
- `kind` (optional): Filter by kind (function, type, interface, enum, class, const)
- `includeUsages` (optional): Include files that import this type. Default: false
- `limit` (optional): Maximum results. Default: 5

**Output includes:**
```
## TypeName (kind)
File: ./path/to/file.ts [offset=9,limit=50]
```

The `offset` and `limit` match the read tool parameters for easy navigation.

### `list_types`

List all TypeScript type names in the project.

**Arguments:**
- `kind` (optional): Filter by kind
- `limit` (optional): Maximum results. Default: 100

## License

MIT
