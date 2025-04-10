<script lang="ts">
  import { onMount } from 'svelte';
  import * as icons from 'svelte-lucide';
  import { browser } from '$app/environment';
  
  // Dynamically import browser-only components
  let G6Graph: any;
  let NodeDetailsPanel: any;
  
  // State variables
  let selectedNode: any = null;
  let isPanelOpen = false;
  let graphComponent: any;
  let isMounted = false;
  
  onMount(async () => {
    // Import components only in the browser
    G6Graph = (await import('$lib/components/admin/G6Graph.svelte')).default;
    NodeDetailsPanel = (await import('$lib/components/admin/NodeDetailsPanel.svelte')).default;
    isMounted = true;
  });
  
  // Handle node selection from the graph
  function handleNodeSelected(node: any) {
    selectedNode = node;
    isPanelOpen = true;
  }
  
  // Handle panel close
  function handlePanelClose() {
    isPanelOpen = false;
  }
  
  // Refresh graph data
  function refreshGraph() {
    if (graphComponent) {
      graphComponent.refreshData();
    }
  }
</script>

<div class="admin-dashboard p-4 h-full">
  <header class="mb-4">
    <div class="flex justify-between items-center">
      <h1 class="text-2xl font-bold">Admin Dashboard</h1>
      <div class="flex space-x-2">
        <button class="btn variant-filled-primary" on:click={refreshGraph}>
          <svelte:component this={icons.RefreshCcw} class="w-4 h-4 mr-2" />
          Refresh Data
        </button>
      </div>
    </div>
    <p class="text-surface-600 dark:text-surface-400 mt-1">
      View and manage the Gun.js database graph.
    </p>
  </header>
  
  <div class="card p-4 bg-white dark:bg-surface-800 shadow rounded-lg">
    <div class="tabs mb-4">
      <button class="tab variant-filled-primary">Database Graph</button>
      <button class="tab">Raw Data</button>
    </div>
    
    <div class="tab-content">
      <div class="graph-view relative" style="height: 700px;">
        {#if isMounted && G6Graph}
          <svelte:component this={G6Graph}
            height="700px" 
            showControls={true} 
            bind:this={graphComponent} 
            on:nodeClick={(e) => handleNodeSelected(e.detail.node)}
          />
          
          {#if NodeDetailsPanel}
            <svelte:component this={NodeDetailsPanel}
              bind:node={selectedNode} 
              bind:isOpen={isPanelOpen}
              on:close={handlePanelClose}
            />
          {/if}
        {:else}
          <div class="flex items-center justify-center h-full">
            <div class="spinner-third w-8 h-8"></div>
            <span class="ml-3">Loading Graph Visualization...</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .admin-dashboard {
    min-height: calc(100vh - 80px);
  }
</style>