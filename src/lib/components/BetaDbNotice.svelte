<!--
Beta Environment Database Notice
Informs users about database schema updates and local storage clearing
Only shows for existing users with last_login before admin cutoff date
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { userStore } from '$lib/stores/userStore';
  import { get } from 'svelte/store';
  import { shouldClearUserStorage, clearUserStorageIfNeeded } from '$lib/services/localStorageService';
  import { logoutUser } from '$lib/services/authService';
  
  let showNotice = $state(false);
  let isClearing = $state(false);
  let hasCleared = $state(false);
  let hasSeenNotice = $state(false);
  
  onMount(async () => {
    if (!browser) return;
    
    // Check if user has already seen this notice
    const noticeKey = 'beta_db_notice_seen_v1';
    hasSeenNotice = localStorage.getItem(noticeKey) === 'true';
    
    if (hasSeenNotice) {
      showNotice = false;
      return;
    }
    
    // Check if storage was already cleared (persistent across page loads)
    const storageCleared = localStorage.getItem('beta_db_storage_cleared') === 'true';
    
    if (storageCleared) {
      showNotice = true;
      hasCleared = true;
      return;
    }

    // Check if cutoff date is set and in the future
    try {
      const { getWipeCutoffDate } = await import('$lib/services/localStorageService');
      const cutoffDate = await getWipeCutoffDate();
      
      if (cutoffDate && cutoffDate > Date.now()) {
        console.log(`[BetaDbNotice] Cutoff date is in future (${new Date(cutoffDate).toISOString()}), showing notice`);
        showNotice = true;
        
        // Start clearing process immediately
        isClearing = true;
        setTimeout(async () => {
          // Clear the storage
          await clearUserStorageIfNeeded();
          // Mark that storage has been cleared
          localStorage.setItem('beta_db_storage_cleared', 'true');
          isClearing = false;
          hasCleared = true;
        }, 2000);
      }
    } catch (error) {
      console.error('[BetaDbNotice] Error checking cutoff date:', error);
    }
  });
  
  async function confirmAndLogout() {
    try {
      // Log out the user
      await logoutUser();
      // Clear the storage cleared flag so notice doesn't show again
      localStorage.removeItem('beta_db_storage_cleared');
      localStorage.setItem('beta_db_notice_seen_v1', 'true');
      showNotice = false;
      // Redirect to register page
      window.location.href = '/register';
    } catch (error) {
      console.error('[BetaDbNotice] Error during logout:', error);
    }
  }

  function dismissNotice() {
    showNotice = false;
    if (browser) {
      localStorage.setItem('beta_db_notice_seen_v1', 'true');
    }
  }
</script>

{#if showNotice}
  <div class="fixed top-0 left-0 right-0 z-[100] bg-warning-500 text-warning-50 p-4 shadow-lg">
    <div class="container mx-auto max-w-4xl">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <h3 class="font-bold text-lg">Beta-Env DB Notice</h3>
            {#if isClearing}
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 border-2 border-warning-100 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-sm">Clearing storage...</span>
              </div>
            {/if}
          </div>
          
          {#if hasCleared}
            <div class="space-y-3">
              <p class="text-sm leading-relaxed">
                ✅ Your local storage has been cleared due to a database schema update.
              </p>
              <p class="text-sm leading-relaxed font-semibold">
                You must register a new account to continue playing.
              </p>
              <button 
                onclick={confirmAndLogout}
                class="bg-warning-600 hover:bg-warning-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
              >
                Confirm & Register New Account
              </button>
            </div>
          {:else}
            <p class="text-sm leading-relaxed">
              The database schema has been updated, your local storage must be cleared. 
              You will now be logged out and must register a new account to play.
            </p>
          {/if}
        </div>
        
        {#if !isClearing && !hasCleared}
          <button 
            onclick={dismissNotice}
            class="ml-4 text-warning-100 hover:text-white transition-colors"
            aria-label="Dismiss notice"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if showNotice}
  <!-- Spacer to prevent content from being hidden behind the notice -->
  <div class="h-20"></div>
{/if}