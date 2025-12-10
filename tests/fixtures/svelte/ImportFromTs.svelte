<script lang="ts">
import { type Status, type ApiResponse, type ID, createId } from "./types";

/**
 * Component props
 */
type LoaderProps = {
	id?: ID;
};

let { id = createId() }: LoaderProps = $props();

let status: Status = $state("idle");
let response: ApiResponse<string> | null = $state(null);

async function load(): Promise<void> {
	status = "loading";
	try {
		// Simulated fetch
		response = { data: `Data for ${id}`, status: "success" };
		status = "success";
	} catch (e) {
		status = "error";
	}
}
</script>

<div>
	<p>Status: {status}</p>
	<button onclick={load}>Load</button>
</div>
