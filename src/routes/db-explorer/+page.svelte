<script>
  import DatabaseViewer from '$lib/components/DatabaseViewer.svelte';
  import { goto } from '$app/navigation';
</script>

<div class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-4">
    <h1 class="h2">Database Explorer</h1>
    <div class="flex gap-2">
      <button 
        class="btn variant-filled-primary"
        onclick={() => goto('/db-explorer/verify')}
      >
        Verify Database
      </button>
      <button 
        class="btn variant-filled-error"
        onclick={() => goto('/reset')}
      >
        Reset Database
      </button>
    </div>
  </div>
  <DatabaseViewer />
</div>