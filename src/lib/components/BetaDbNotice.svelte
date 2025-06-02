<!--
Beta Environment Database Notice
Informs users about database schema updates and local storage clearing
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let showNotice = $state(true);
  let hasSeenNotice = $state(false);
  
  onMount(() => {
    if (browser) {
      // Check if user has already seen this notice
      const noticeKey = 'beta_db_notice_seen_v1';
      hasSeenNotice = localStorage.getItem(noticeKey) === 'true';
      showNotice = !hasSeenNotice;
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
          <h3 class="font-bold text-lg mb-2">Beta-Env DB Notice</h3>
          <p class="text-sm leading-relaxed">
            The database schema has been updated, your local storage must be cleared. 
            You will now be logged out and must register a new account to play.
          </p>
        </div>
        <button 
          onclick={dismissNotice}
          class="ml-4 text-warning-100 hover:text-white transition-colors"
          aria-label="Dismiss notice"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showNotice}
  <!-- Spacer to prevent content from being hidden behind the notice -->
  <div class="h-20"></div>
{/if}