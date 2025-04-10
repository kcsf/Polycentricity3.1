<script>
  export let nodes = [];
  export let edges = [];
  
  import { onMount } from 'svelte';
  
  let container;
  let stats = {
    totalNodes: 0,
    totalEdges: 0,
    nodeTypes: {},
  };
  
  $: {
    // Calculate statistics whenever nodes or edges change
    stats.totalNodes = nodes.length;
    stats.totalEdges = edges.length;
    
    // Count node types
    stats.nodeTypes = {};
    nodes.forEach(node => {
      const type = node.type || 'unknown';
      stats.nodeTypes[type] = (stats.nodeTypes[type] || 0) + 1;
    });
  }
</script>

<div class="fallback-container p-4 rounded-lg bg-surface-50-900-token">
  <div class="alert variant-filled-warning mb-4">
    <p>
      <strong>G6 Visualization temporarily unavailable</strong>
    </p>
    <p class="text-sm">
      We're currently experiencing issues with the G6 visualization library. 
      Here's a summary of the database instead:
    </p>
  </div>
  
  <div class="stats-grid grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <div class="stat-card p-4 rounded-lg bg-primary-100 dark:bg-primary-900">
      <h3 class="text-lg font-bold">Nodes</h3>
      <p class="text-3xl font-bold">{stats.totalNodes}</p>
    </div>
    
    <div class="stat-card p-4 rounded-lg bg-secondary-100 dark:bg-secondary-900">
      <h3 class="text-lg font-bold">Edges</h3>
      <p class="text-3xl font-bold">{stats.totalEdges}</p>
    </div>
    
    <div class="stat-card p-4 rounded-lg bg-tertiary-100 dark:bg-tertiary-900">
      <h3 class="text-lg font-bold">Connected Data</h3>
      <p class="text-3xl font-bold">{Math.round(stats.totalEdges / Math.max(stats.totalNodes, 1) * 10) / 10}</p>
      <p class="text-xs">edges per node</p>
    </div>
  </div>
  
  <div class="node-types mb-6">
    <h3 class="text-lg font-bold mb-2">Node Types</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each Object.entries(stats.nodeTypes) as [type, count]}
        <div class="flex items-center justify-between p-3 bg-surface-100-800-token rounded-lg">
          <div class="flex items-center">
            <div class="w-3 h-3 rounded-full mr-2" 
                style="background-color: {type === 'users' ? '#5B8FF9' : 
                                       type === 'games' ? '#5AD8A6' : 
                                       type === 'actors' ? '#5D7092' : 
                                       type === 'chat' ? '#F6BD16' : 
                                       type === 'agreements' ? '#E8684A' : '#999'}">
            </div>
            <span class="capitalize">{type}</span>
          </div>
          <span class="font-mono font-semibold">{count}</span>
        </div>
      {/each}
    </div>
  </div>
  
  <div class="mb-6">
    <h3 class="text-lg font-bold mb-2">Most Connected Nodes</h3>
    <div class="overflow-x-auto">
      <table class="table-auto w-full">
        <thead>
          <tr class="bg-surface-200-700-token">
            <th class="p-2 text-left">ID</th>
            <th class="p-2 text-left">Label</th>
            <th class="p-2 text-right">Type</th>
          </tr>
        </thead>
        <tbody>
          {#each nodes.slice(0, 10) as node}
            <tr class="border-b border-surface-200-700-token">
              <td class="p-2 font-mono text-xs">{node.id.substring(0, 12)}...</td>
              <td class="p-2">{node.label || 'No Label'}</td>
              <td class="p-2 text-right">{node.type || 'unknown'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  
  <div class="text-center p-4 bg-surface-100-800-token rounded-lg">
    <p class="text-sm">
      Database snapshot generated at {new Date().toLocaleTimeString()}
    </p>
  </div>
</div>

<style>
  .fallback-container {
    min-height: 600px;
    width: 100%;
  }
</style>