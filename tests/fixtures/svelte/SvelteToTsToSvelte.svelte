<script lang="ts">
// Svelte → TS → Svelte chain
// This imports from ts-imports-svelte.ts which imports from ModuleScript.svelte
import { createPriceDisplay, type PriceDisplay } from "./ts-imports-svelte";

type Props = {
	amount: number;
};

let { amount }: Props = $props();

let display: PriceDisplay | null = $state(null);

function showPrice(): void {
	display = createPriceDisplay(amount, "EUR");
}
</script>

<div>
	{#if display}
		<p>{display.formatted}</p>
	{:else}
		<button onclick={showPrice}>Show Price</button>
	{/if}
</div>
