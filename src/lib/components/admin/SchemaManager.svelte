<script lang="ts">
  import { initializeSampleData, verifySampleData } from '$lib/services/sampleDataService';
  import * as icons from 'svelte-lucide';
  
  let isInitializing = false;
  let isVerifying = false;
  let result: { success: boolean; message: string } | null = null;
  
  async function initializeData() {
    if (!confirm('Are you sure you want to initialize sample data with the new schema? This will add sample users, cards, decks, games, actors, agreements, chats, and node positions.')) {
      return;
    }
    
    try {
      isInitializing = true;
      result = null;
      result = await initializeSampleData();
    } catch (error) {
      console.error('Error initializing sample data:', error);
      result = {
        success: false,
        message: `Failed to initialize sample data: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      isInitializing = false;
    }
  }
  
  async function verifyData() {
    try {
      isVerifying = true;
      result = null;
      result = await verifySampleData();
    } catch (error) {
      console.error('Error verifying sample data:', error);
      result = {
        success: false,
        message: `Failed to verify sample data: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      isVerifying = false;
    }
  }
</script>

<div class="card p-4 bg-surface-50-900-token">
  <h3 class="h4 mb-4 flex items-center">
    <svelte:component this={icons.Database} class="w-5 h-5 mr-2 text-primary-500" />
    Database Schema Management
  </h3>
  
  <p class="mb-4">
    This tool allows you to initialize the database with sample data for the new schema structure.
  </p>
  
  <div class="flex flex-wrap gap-4 mb-6">
    <button 
      class="btn variant-filled-primary" 
      on:click={initializeData}
      disabled={isInitializing || isVerifying}
    >
      {#if isInitializing}
        <div class="spinner-third w-4 h-4 mr-2"></div>
        Initializing...
      {:else}
        <svelte:component this={icons.Plus} class="w-4 h-4 mr-2" />
        Initialize Sample Data
      {/if}
    </button>
    
    <button 
      class="btn variant-filled-secondary" 
      on:click={verifyData}
      disabled={isInitializing || isVerifying}
    >
      {#if isVerifying}
        <div class="spinner-third w-4 h-4 mr-2"></div>
        Verifying...
      {:else}
        <svelte:component this={icons.Check} class="w-4 h-4 mr-2" />
        Verify Sample Data
      {/if}
    </button>
  </div>
  
  {#if result}
    <div class="alert {result.success ? 'variant-filled-success' : 'variant-filled-error'} mb-4">
      <svelte:component this={result.success ? icons.CheckCircle : icons.AlertTriangle} class="w-5 h-5" />
      <div class="alert-message">
        <h4 class="h5">{result.success ? 'Success' : 'Error'}</h4>
        <p>{result.message}</p>
      </div>
    </div>
  {/if}
  
  <div class="p-4 bg-surface-100-800-token rounded-lg">
    <h4 class="font-semibold mb-2">New Schema Structure</h4>
    <ul class="list-disc ml-6 space-y-1 text-sm">
      <li><span class="font-mono text-primary-500">users</span> - Now includes user roles (Guest, Member, Admin)</li>
      <li><span class="font-mono text-primary-500">cards</span> - Static role templates with consistent properties</li>
      <li><span class="font-mono text-primary-500">decks</span> - Collections of cards used in games</li>
      <li><span class="font-mono text-primary-500">actors</span> - Links users to specific cards in a game</li>
      <li><span class="font-mono text-primary-500">agreements</span> - Includes obligations and benefits directly</li>
      <li><span class="font-mono text-primary-500">chat</span> - Group or private messaging between users</li>
      <li><span class="font-mono text-primary-500">node_positions</span> - X/Y coordinates for graph visualization</li>
    </ul>
  </div>
</div>