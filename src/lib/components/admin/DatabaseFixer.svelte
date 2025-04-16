<script lang="ts">
  import * as icons from 'lucide-svelte';
  import { getGun, nodes, generateId, put } from '$lib/services/gunService';
  import { initializeSampleData, verifySampleData } from '$lib/services/sampleDataService';
  import type { User } from '$lib/types';
  
  let isWorking = false;
  let isInitializing = false;
  let result: { success: boolean; message: string } | null = null;
  
  async function fixDatabase() {
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
  
  async function initializeDb() {
    if (isInitializing) return;
    
    isInitializing = true;
    result = null;
    
    try {
      console.log("Starting sample data initialization");
      const initResult = await initializeSampleData();
      
      if (initResult && initResult.success) {
        console.log("Successfully initialized sample data");
        console.log("Starting data verification");
        
        await verifySampleData();
        
        result = {
          success: true,
          message: "Successfully initialized the database with sample data. Refresh the page to see the changes."
        };
      } else {
        const errorMsg = initResult?.message || "Unknown error during initialization";
        console.error("Error initializing sample data:", errorMsg);
        result = {
          success: false,
          message: errorMsg
        };
      }
    } catch (error) {
      console.error("Critical error during initialization:", error);
      result = {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    } finally {
      isInitializing = false;
    }
  }
</script>

<div class="card p-4 bg-surface-50-900-token">
  <h3 class="h4 mb-4 flex items-center">
    <svelte:component this={icons.Database} class="w-5 h-5 mr-2 text-tertiary-500" />
    Database Tools
  </h3>
  
  <p class="mb-4">
    These tools help fix and maintain the Gun.js database. You can create admin users or initialize the database with sample data.
  </p>
  
  <div class="flex flex-col gap-4">
    <div class="card p-2 variant-soft">
      <h4 class="h5 mb-2">Admin Creation</h4>
      <p class="text-sm mb-2">Create a special admin user when authentication has issues.</p>
      <button 
        class="btn variant-filled-tertiary" 
        on:click={fixDatabase}
        disabled={isWorking || isInitializing}
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
    
    <div class="card p-2 variant-soft">
      <h4 class="h5 mb-2">Sample Data</h4>
      <p class="text-sm mb-2">Initialize the database with sample data including a deck, cards, and relationships.</p>
      <button 
        class="btn variant-filled-primary" 
        on:click={initializeDb}
        disabled={isWorking || isInitializing}
      >
        {#if isInitializing}
          <div class="spinner-third w-4 h-4 mr-2"></div>
          Initializing Database...
        {:else}
          <svelte:component this={icons.Database} class="w-4 h-4 mr-2" />
          Initialize Sample Data
        {/if}
      </button>
    </div>
    
    {#if result}
      <div class="alert {result.success ? 'variant-filled-success' : 'variant-filled-error'} mt-4">
        <svelte:component this={result.success ? icons.CheckCircle : icons.AlertTriangle} class="w-5 h-5" />
        <div class="alert-message">
          <h4 class="h5">{result.success ? 'Success' : 'Error'}</h4>
          <p>{result.message}</p>
        </div>
      </div>
    {/if}
  </div>
</div>