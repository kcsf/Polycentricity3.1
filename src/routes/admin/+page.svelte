<script lang="ts">
  import { onMount } from 'svelte';
  import G6Graph from '$lib/components/admin/G6Graph.svelte';
  import NodeDetailsPanel from '$lib/components/admin/NodeDetailsPanel.svelte';
  import * as icons from 'svelte-lucide';
  
  // State variables
  let selectedNode: any = null;
  let isPanelOpen = false;
  let graphComponent: G6Graph;
  
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
        <G6Graph 
          height="700px" 
          showControls={true} 
          bind:this={graphComponent} 
          on:nodeClick={e => handleNodeSelected(e.detail.node)}
        />
        
        <NodeDetailsPanel 
          bind:node={selectedNode} 
          bind:isOpen={isPanelOpen}
          on:close={handlePanelClose}
        />
      </div>
    </div>
  </div>
</div>

<style>
  .admin-dashboard {
    min-height: calc(100vh - 80px);
  }
</style>