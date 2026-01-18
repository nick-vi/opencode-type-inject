import type { User } from "./user";

export function getUser(id: string): User {
	return {
		id,
		name: "test",
		email: "test@test.com",
		role: { name: "admin", permissions: [] },
	};
}
