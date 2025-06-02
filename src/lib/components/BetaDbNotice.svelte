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
  
  let showNotice = $state(false);
  let isClearing = $state(false);
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
    
    // Get current user
    const user = get(userStore);
    
    // Only show notice if user exists and needs storage clearing
    if (user.isAuthenticated && user.user) {
      // Check if this user needs their storage cleared (without actually clearing it)
      const needsClearing = await shouldClearUserStorage(user.user.user_id);
      showNotice = needsClearing;
      
      // If storage needs clearing, start the clearing process
      if (needsClearing) {
        isClearing = true;
        // Give a moment for the UI to show the loading state
        setTimeout(async () => {
          // Actually clear the storage
          await clearUserStorageIfNeeded();
          isClearing = false;
          // Refresh the page after clearing
          window.location.reload();
        }, 2000);
      }
    }
  });
  
  function dismissNotice() {
    showNotice = false;
    if (browser) {
      localStorage.setItem('beta_db_notice_seen_v1', 'true');
    }
  }
</script>

{#if showNotice}
  <div class="fixed top-0 left-0 right-0 z-50 bg-warning-500 text-warning-50 p-4 shadow-lg">
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
          <p class="text-sm leading-relaxed">
            The database schema has been updated, your local storage must be cleared. 
            You will now be logged out and must register a new account to play.
          </p>
        </div>
        {#if !isClearing}
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