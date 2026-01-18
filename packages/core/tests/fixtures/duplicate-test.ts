import type { Role } from "./depth-test/role";
import type { User } from "./depth-test/user";

// Both User and Role are imported
// User also references Role internally
// Could we get Role twice?

export function test(user: User, role: Role): void {
	console.log(user, role);
}
