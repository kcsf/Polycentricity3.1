<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  
  // Define props
  let { roles, redirectTo } = $props<{
    roles: Array<'Guest' | 'Member' | 'Admin'>,
    redirectTo: string
  }>();
  
  let isAuthorized = $state(false);
  let isChecking = $state(true);
  
  onMount(() => {
    checkAuthorization();
  });
  
  $effect(() => {
    if ($userStore.isAuthenticated !== undefined) {
      checkAuthorization();
    }
  });
  
  function checkAuthorization() {
    isChecking = true;
    
    // Not authenticated at all
    if (!$userStore.isAuthenticated || !$userStore.user) {
      isChecking = false;
      isAuthorized = false;
      goto(redirectTo);
      return;
    }
    
    // Check if user role is in allowed roles
    if (roles.includes($userStore.user.role as any)) {
      isChecking = false;
      isAuthorized = true;
    } else {
      isChecking = false;
      isAuthorized = false;
      goto(redirectTo);
    }
  }
</script>

{#if isAuthorized && !isChecking}
  <slot />
{/if}

{#if isChecking}
  <div class="flex justify-center items-center min-h-screen">
    <div class="card p-4 bg-surface-900-100 text-center">
      <div class="flex items-center justify-center gap-4">
        <div class="spinner-border h-10 w-10" role="status" aria-hidden="true"></div>
        <p>Checking authorization...</p>
      </div>
    </div>
  </div>
{/if}