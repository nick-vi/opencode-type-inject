<script lang="ts" module>
/**
 * Module-level shared type
 */
export type SharedConfig = {
	theme: "light" | "dark";
	locale: string;
};

export function getDefaultConfig(): SharedConfig {
	return { theme: "light", locale: "en" };
}
</script>

<script lang="ts">
// Module exports are automatically available - no import needed in Svelte 5

/**
 * Instance-level props type
 */
type BothProps = {
	config?: SharedConfig;
};

let { config = getDefaultConfig() }: BothProps = $props();

function updateTheme(theme: SharedConfig['theme']): void {
	config = { ...config, theme };
}
</script>

<div>Current theme: {config.theme}</div>
