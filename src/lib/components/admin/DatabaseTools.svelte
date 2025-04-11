<script lang="ts">
  import * as icons from 'svelte-lucide';
  import { getGun, nodes, generateId, put } from '$lib/services/gunService';
  import { initializeSampleData, verifySampleData } from '$lib/services/sampleDataService';
  import type { User } from '$lib/types';
  
  let isWorking = false;
  let isInitializing = false;
  let isVerifying = false;
  let result: { success: boolean; message: string } | null = null;
  
  // Create admin user function
  async function createAdminUser() {
    if (isWorking) return;
    
    isWorking = true;
    result = null;
    const gun = getGun();
    
    try {
      // Create a special admin user for Bjorn
      const userId = `user_${generateId()}`;
      
      const userData: User = {
        user_id: userId,
        name: 'Bjorn',
        email: 'bjorn@endogon.com',
        created_at: Date.now(),
        role: 'Admin'
      };
      
      // Using the improved put function with proper timeout handling
      const userResult = await put(`${nodes.users}/${userId}`, userData);
      
      if (userResult.err) {
        throw new Error(`Error creating user: ${userResult.err}`);
      }
      
      console.log(`Created admin user with ID: ${userId}`);
      
      result = {
        success: true,
        message: `Created Admin user with ID: ${userId}. You can now use "admin@example.com" with any password to access admin features.`
      };
    } catch (error) {
      console.error('Error fixing database:', error);
      result = {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    } finally {
      isWorking = false;
    }
  }
  
  // Initialize sample data function
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
  
  // Verify sample data function
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
    <svelte:component this={icons.Database} class="w-5 h-5 mr-2 text-tertiary-500" />
    Database Tools
  </h3>
  
  <p class="mb-4">
    These tools help manage, initialize, and verify the Gun.js database.
  </p>
  
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
    <!-- Sample Data Initialization -->
    <div class="card p-4 variant-soft">
      <h4 class="h5 mb-2">Sample Data</h4>
      <p class="text-sm mb-4">
        Initialize the database with sample data, including users, cards, decks, games, actors, agreements, chat, and node positions.
      </p>
      <div class="flex flex-col gap-2">
        <button 
          class="btn variant-filled-primary" 
          on:click={initializeData}
          disabled={isInitializing || isVerifying || isWorking}
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
          disabled={isInitializing || isVerifying || isWorking}
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
    </div>
    
    <!-- Admin Creation -->
    <div class="card p-4 variant-soft">
      <h4 class="h5 mb-2">Admin Creation</h4>
      <p class="text-sm mb-4">
        Create a special admin user when authentication has issues. This is useful for development and testing purposes.
      </p>
      <button 
        class="btn variant-filled-tertiary w-full" 
        on:click={createAdminUser}
        disabled={isWorking || isInitializing || isVerifying}
      >
        {#if isWorking}
          <div class="spinner-third w-4 h-4 mr-2"></div>
          Creating Admin...
        {:else}
          <svelte:component this={icons.UserCog} class="w-4 h-4 mr-2" />
          Create Admin User
        {/if}
      </button>
    </div>
    
    <!-- Schema Reference -->
    <div class="card p-4 variant-soft">
      <h4 class="h5 mb-2">Schema Reference</h4>
      <p class="text-sm mb-2">
        Overview of the Gun.js database schema structure.
      </p>
      <div class="bg-surface-100-800-token p-3 rounded-lg">
        <ul class="list-disc ml-4 space-y-1 text-sm">
          <li><span class="font-mono text-primary-500">users</span> - User accounts with roles</li>
          <li><span class="font-mono text-primary-500">cards</span> - Role templates with properties</li>
          <li><span class="font-mono text-primary-500">decks</span> - Collections of cards for games</li>
          <li><span class="font-mono text-primary-500">actors</span> - Links users to cards in games</li>
          <li><span class="font-mono text-primary-500">agreements</span> - Contracts between actors</li>
          <li><span class="font-mono text-primary-500">chat</span> - Group/private messaging</li>
          <li><span class="font-mono text-primary-500">positions</span> - Graph coordinates</li>
        </ul>
      </div>
    </div>
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
  
  <div class="bg-surface-100-800-token p-4 rounded-lg">
    <h4 class="font-semibold mb-2 flex items-center">
      <svelte:component this={icons.Info} class="w-4 h-4 mr-2 text-info-500" />
      Gun.js Database Tips
    </h4>
    <ul class="list-disc ml-6 space-y-1 text-sm">
      <li>Use objects with <code>{{ '{id: true}' }}</code> pattern for relationships instead of arrays</li>
      <li>Store arrays as objects with numbered keys <code>{{ '{0: item1, 1: item2}' }}</code></li>
      <li>Add delays between database operations to avoid conflicts</li>
      <li>Use proper bidirectional relationships with Gun's <code>set()</code> method</li>
      <li>Reset browser local storage to completely clear Gun.js data in development</li>
    </ul>
  </div>
</div>