<script lang="ts">
  /**
   * User data type
   */
  export type UserData = {
    id: string;
    name: string;
    email: string;
  };

  /**
   * Props using Svelte 5 $props() rune
   */
  type Props = {
    user: UserData;
    onSave?: (user: UserData) => void;
    readonly?: boolean;
  };

  let { user, onSave, readonly = false }: Props = $props();

  function handleSave(): void {
    onSave?.(user);
  }
</script>

<div class="user-card">
  <h2>{user.name}</h2>
  <p>{user.email}</p>
  {#if !readonly}
    <button onclick={handleSave}>Save</button>
  {/if}
</div>
