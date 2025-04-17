<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { addSampleAgreementsToGame } from '$lib/services/sampleAgreementService';
  import { Spinner } from '$lib/components/ui/spinner';
  import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert';
  import { InfoCircle, CheckCircle, AlertCircle, RefreshCw } from 'lucide-svelte';
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
  <Button 
    variant="outline" 
    class="w-full flex items-center justify-center gap-2"
    disabled={isLoading}
    on:click={generateAgreements}
  >
    {#if isLoading}
      <Spinner class="h-4 w-4" />
    {:else}
      <RefreshCw class="h-4 w-4" />
    {/if}
    Generate Sample Agreements
  </Button>
  
  {#if showAlert && result}
    <div class="mt-2">
      {#if result.success}
        <Alert variant="success" class="border-emerald-500 bg-emerald-50 dark:bg-emerald-950">
          <CheckCircle class="h-4 w-4 text-emerald-500" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>
            Created {result.count} sample agreement{result.count !== 1 ? 's' : ''}.
          </AlertDescription>
        </Alert>
      {:else}
        <Alert variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {result.error || "Failed to create sample agreements"}
          </AlertDescription>
        </Alert>
      {/if}
    </div>
  {/if}
</div>