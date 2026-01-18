/**
 * API endpoint configuration
 */
export const API_ENDPOINTS = {
	users: "/api/users",
	posts: "/api/posts",
	comments: "/api/comments",
} as const;

/**
 * Application configuration (frozen object)
 */
export const APP_CONFIG = Object.freeze({
	apiUrl: "https://api.example.com",
	timeout: 5000,
	retries: 3,
	version: "1.0.0",
});

/**
 * Feature flags
 */
export const FEATURES = {
	enableAuth: true,
	enableCache: false,
	maxUploadSize: 10485760,
} as const;

/**
 * User status enum
 */
export enum UserStatus {
	Active = "active",
	Inactive = "inactive",
	Pending = "pending",
	Suspended = "suspended",
}

/**
 * Get endpoint URL by name
 */
export function getEndpoint(name: keyof typeof API_ENDPOINTS): string {
	return `${APP_CONFIG.apiUrl}${API_ENDPOINTS[name]}`;
}
