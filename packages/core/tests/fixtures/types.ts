/**
 * Base user type
 */
export type BaseUser = {
	id: string;
	name: string;
};

/**
 * Email type
 */
export type Email = string;

/**
 * User with email
 */
export type UserWithEmail = BaseUser & {
	email: Email;
};
