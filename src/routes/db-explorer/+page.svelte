<script>
  import DatabaseViewer from '$lib/components/DatabaseViewer.svelte';
  import { goto } from '$app/navigation';
</script>

<div class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-4">
    <h1 class="h2">Database Explorer</h1>
    <button 
      class="btn variant-filled-primary"
      onclick={() => goto('/db-explorer/verify')}
    >
      Verify Database
    </button>
  </div>
  <DatabaseViewer />
</div>