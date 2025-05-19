<script lang="ts">
  import DatabaseViewer from '$lib/components/DatabaseViewer.svelte';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getGun } from '$lib/services/gunService';

  onMount(() => {
    if (import.meta.env.DEV) {
      const gun = getGun();
      if (gun) {
        // window.gun is already typed via your gun.d.ts
        window.gun = gun;
        console.log('🎯 Gun instance is now on window.gun', window.gun);
      } else {
        console.warn('Gun instance not initialized yet');
      }
    }
  });
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