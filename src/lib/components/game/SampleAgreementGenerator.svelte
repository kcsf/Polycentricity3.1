<script lang="ts">
  import { addSampleAgreementsToGame } from '$lib/services/sampleAgreementService';
  import { RefreshCw } from 'lucide-svelte';
  import { onDestroy } from 'svelte';
  
  // Props
  export let gameId: string;
  export let refreshBoard: () => void;
  
  // State
  let isLoading = false;
  let result: {
    success: boolean;
    count: number;
    error?: string;
  } | null = null;
  let showAlert = false;
  let alertTimeout: NodeJS.Timeout;
  
  // Method to generate sample agreements
  async function generateAgreements() {
    // Clear any existing alert
    clearTimeout(alertTimeout);
    showAlert = false;
    
    if (!gameId) {
      result = {
        success: false,
        count: 0,
        error: "No game ID provided"
      };
      showAlert = true;
      return;
    }
    
    try {
      isLoading = true;
      result = await addSampleAgreementsToGame(gameId);
      
      if (result.success && typeof refreshBoard === 'function') {
        // Delay refresh to ensure agreements are saved
        setTimeout(() => {
          refreshBoard();
        }, 1000);
      }
      
      showAlert = true;
      
      // Auto-hide alert after 5 seconds
      alertTimeout = setTimeout(() => {
        showAlert = false;
      }, 5000);
      
    } catch (error) {
      console.error("Error generating sample agreements:", error);
      result = {
        success: false,
        count: 0,
        error: error.message || "Unknown error generating agreements"
      };
      showAlert = true;
    } finally {
      isLoading = false;
    }
  }
  
  // Clean up on destroy
  onDestroy(() => {
    if (alertTimeout) {
      clearTimeout(alertTimeout);
    }
  });
</script>

<div class="w-full">
  <button 
    class="btn btn-sm variant-outline w-full flex items-center justify-center gap-2"
    disabled={isLoading}
    onclick={generateAgreements}
  >
    {#if isLoading}
      <div class="spinner-border animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
    {:else}
      <RefreshCw class="h-4 w-4" />
    {/if}
    Generate Sample Agreements
  </button>
  
  {#if showAlert && result}
    <div class="mt-2">
      {#if result.success}
        <div class="alert variant-filled-success">
          <div class="flex items-center gap-2">
            <div class="h-4 w-4 text-success-500">✓</div>
            <div>
              <h4 class="h5">Success</h4>
              <p class="text-sm">
                Created {result.count} sample agreement{result.count !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>
        </div>
      {:else}
        <div class="alert variant-filled-error">
          <div class="flex items-center gap-2">
            <div class="h-4 w-4">⚠️</div>
            <div>
              <h4 class="h5">Error</h4>
              <p class="text-sm">
                {result.error || "Failed to create sample agreements"}
              </p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>