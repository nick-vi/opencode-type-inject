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

When an LLM reads a TypeScript file, this plugin automatically:

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
<types count="3" tokens="~40">
function getUser(id: string): User

type User = { id: string; name: string; role: Role; }

type Role = { name: string; permissions: Permission[]; }

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

## Tools

### `lookup_type`

Look up TypeScript type definitions by name.

**Arguments:**
- `name` (required): Type name to search for
- `exact` (optional): Exact match or contains. Default: true
- `kind` (optional): Filter by kind (function, type, interface, enum, class, const)
- `includeUsages` (optional): Include files that import this type. Default: false
- `limit` (optional): Maximum results. Default: 5

### `list_types`

List all TypeScript type names in the project.

**Arguments:**
- `kind` (optional): Filter by kind
- `limit` (optional): Maximum results. Default: 100

## License

MIT
