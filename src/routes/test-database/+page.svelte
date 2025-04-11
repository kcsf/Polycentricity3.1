<script lang="ts">
  import { onMount } from 'svelte';
  import { saveSimpleItem, getSimpleItem, getAllSimpleItems, deleteSimpleItem, cleanupTestData } from './simple-test';
  import { nodes } from '$lib/services/gunService';
  import { radiskLoaded } from '$lib/services/gunRadiskAdapter';
  
  let testStatus = '';
  let testId = '';
  let testResultsText = '';
  let testInProgress = false;
  let testData: any = null;
  
  // Simple test data examples - using minimal data for basic tests
  const simpleTestData = {
    name: 'Simple Test',
    timestamp: Date.now(),
    value: 42,
    tags: ['tag1', 'tag2']
  };
  
  // Node types for exploration
  const nodeTypes = Object.keys(nodes);
  
  onMount(() => {
    console.log('Test Database page mounted');
    testStatus = radiskLoaded 
      ? 'Gun.js initialized with Radisk adapter' 
      : 'Gun.js initialized (Radisk not activated)';
  });
  
  async function runBasicTest() {
    testInProgress = true;
    testStatus = 'Running basic test...';
    testData = null;
    
    try {
      // Create a new test item with current timestamp
      const testItem = {
        ...simpleTestData,
        timestamp: Date.now()
      };
      
      // Save a simple test item
      const saveResult = await saveSimpleItem(testItem);
      
      if (saveResult.success) {
        testId = saveResult.id;
        testStatus = `Test item saved with ID: ${testId}`;
        
        // Add a slight delay before retrieving
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to get it back
        const getResult = await getSimpleItem(testId);
        if (getResult.success) {
          testResultsText = JSON.stringify(getResult.data, null, 2);
          testData = getResult.data;
          testStatus = 'Basic test successful!';
        } else {
          // Still show what was attempted to save
          testResultsText = JSON.stringify(testItem, null, 2);
          testData = testItem;
          testStatus = `Error retrieving test item (but saved): ${getResult.error}`;
        }
      } else {
        testStatus = `Error saving test item: ${saveResult.error}`;
      }
    } catch (error) {
      testStatus = `Test error: ${error instanceof Error ? error.message : String(error)}`;
      console.error('Test error:', error);
    } finally {
      testInProgress = false;
    }
  }

  async function cleanupAllTestData() {
    testInProgress = true;
    testStatus = 'Cleaning up all test data...';
    
    try {
      const result = await cleanupTestData();
      
      if (result.success) {
        testStatus = 'All test data cleaned up successfully';
        testData = null;
        testResultsText = '';
        testId = '';
      } else {
        testStatus = `Error cleaning up test data: ${result.error}`;
      }
    } catch (error) {
      testStatus = `Cleanup error: ${error instanceof Error ? error.message : String(error)}`;
      console.error('Cleanup error:', error);
    } finally {
      testInProgress = false;
    }
  }
  
  async function viewAllTestData() {
    testInProgress = true;
    testStatus = 'Retrieving all test items...';
    
    try {
      const result = await getAllSimpleItems();
      
      if (result.success) {
        const itemsObj = result.items || {};
        const itemCount = Object.keys(itemsObj).length;
        testStatus = `Retrieved ${itemCount} test items`;
        testData = itemsObj;
        testResultsText = JSON.stringify(itemsObj, null, 2);
      } else {
        testStatus = `Error retrieving test items: ${result.error}`;
      }
    } catch (error) {
      testStatus = `View error: ${error instanceof Error ? error.message : String(error)}`;
      console.error('View error:', error);
    } finally {
      testInProgress = false;
    }
  }
</script>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">Gun.js Database Test</h1>
  
  <div class="card p-4 mb-6 variant-soft">
    <div class="mb-2 p-2 variant-filled-primary rounded-sm">
      <p class="font-bold">Radisk Status: 
        <span class:text-success-500={radiskLoaded} class:text-error-500={!radiskLoaded}>
          {radiskLoaded ? 'ACTIVE ✓' : 'INACTIVE ✗'}
        </span>
      </p>
      <p class="text-sm">{radiskLoaded ? 'IndexedDB storage activated' : 'Using in-memory storage only'}</p>
    </div>
    
    <div class="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
      <button 
        class="btn variant-filled-primary" 
        on:click={runBasicTest} 
        disabled={testInProgress}>
        {testInProgress ? 'Working...' : 'Run Basic Test'}
      </button>
      
      <button 
        class="btn variant-filled-secondary" 
        on:click={viewAllTestData} 
        disabled={testInProgress}>
        {testInProgress ? 'Working...' : 'View All Test Data'}
      </button>
      
      <button 
        class="btn variant-filled-warning" 
        on:click={cleanupAllTestData} 
        disabled={testInProgress}>
        {testInProgress ? 'Working...' : 'Cleanup All Test Data'}
      </button>
    </div>
    
    {#if testStatus}
      <div class="mt-4 p-3 rounded {testStatus.includes('Error') ? 'bg-error-500/20' : 'bg-surface-100-800-token'}">
        <p class="font-semibold">Status:</p>
        <p>{testStatus}</p>
      </div>
    {/if}
    
    {#if testId}
      <div class="mt-2 p-3 rounded bg-surface-100-800-token">
        <p class="font-semibold">Test ID:</p>
        <p class="font-mono text-sm">{testId}</p>
      </div>
    {/if}
  </div>
  
  {#if testData}
    <div class="card p-4 mb-6 variant-soft">
      <h2 class="text-xl font-semibold mb-2">Test Results:</h2>
      <pre class="p-3 bg-surface-100-800-token rounded text-sm overflow-auto max-h-80">{testResultsText}</pre>
    </div>
  {/if}
  
  <!-- Database information panel -->
  <div class="card p-4 variant-ghost mt-4">
    <h2 class="font-semibold mb-2">Gun.js Database Structure</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {#each nodeTypes as type}
        <div class="p-2 rounded bg-surface-100-800-token">
          <span class="font-mono text-primary-500">{type}:</span> {nodes[type as keyof typeof nodes]}
        </div>
      {/each}
      <div class="p-2 rounded bg-surface-100-800-token">
        <span class="font-mono text-primary-500">test_data:</span> (temporary test root)
      </div>
    </div>
  </div>
</div>