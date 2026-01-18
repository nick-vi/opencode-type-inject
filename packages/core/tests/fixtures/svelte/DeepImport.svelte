<script lang="ts">
// This tests deep import resolution: Svelte → TS → TS → TS → TS
import { getUser } from "../depth-test/main";
import type { User } from "../depth-test/user";

type Props = {
	userId: string;
};

let { userId }: Props = $props();

let user: User | null = $state(null);

async function loadUser(): Promise<void> {
	user = getUser(userId);
}
</script>

<div>
	{#if user}
		<p>{user.name} ({user.role.name})</p>
	{:else}
		<button onclick={loadUser}>Load User</button>
	{/if}
</div>
