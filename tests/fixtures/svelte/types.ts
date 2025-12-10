/**
 * Shared types for Svelte components
 */

export type Status = "idle" | "loading" | "success" | "error";

export interface ApiResponse<T> {
	data: T;
	status: Status;
	error?: string;
}

export type ID = string | number;

export function createId(): ID {
	return Math.random().toString(36).slice(2);
}
