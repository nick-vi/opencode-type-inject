<script lang="ts">
import { onMount } from "svelte";

/**
 * Props for the Counter component
 */
type CounterProps = {
	initialCount?: number;
	step?: number;
	onCountChange?: (count: number) => void;
};

let props: CounterProps = $props();
const { step = 1, onCountChange } = props;

let count = $state(props.initialCount ?? 0);

function increment(): void {
	count += step;
	onCountChange?.(count);
}

function decrement(): void {
	count -= step;
	onCountChange?.(count);
}

/**
 * Reset the counter to initial value
 */
function reset(): void {
	count = props.initialCount ?? 0;
	onCountChange?.(count);
}

onMount(() => {
	console.log("Counter mounted");
});
</script>

<div class="counter">
	<button onclick={decrement}>-</button>
	<span>{count}</span>
	<button onclick={increment}>+</button>
	<button onclick={reset}>Reset</button>
</div>

<style>
.counter {
	display: flex;
	gap: 1rem;
	align-items: center;
}
</style>
