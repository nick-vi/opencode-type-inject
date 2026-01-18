// Depth 3: Imported by role.ts
import type { AuditLog } from "./audit";

export type Permission = {
	action: string;
	resource: string;
	audit?: AuditLog;
};
