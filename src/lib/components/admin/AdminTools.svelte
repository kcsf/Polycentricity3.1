<script lang="ts">
  import { updateUserToAdmin } from '$lib/services/authService';
  import { fixGameRelationships } from '$lib/services/gameService';
  import * as icons from '@lucide/svelte';
  
  let isUpdating = false;
  let isFixingGames = false;
  let result: { success: boolean; message: string } | null = null;
  let gameFixResult: { success: boolean; message: string } | null = null;
  let adminEmail = '';
  
  async function makeAdmin() {
    if (!adminEmail.trim()) {
      result = {
        success: false,
        message: 'Please enter an email address'
      };
      return;
    }
    
    try {
      isUpdating = true;
      result = null;
      
      const success = await updateUserToAdmin(adminEmail);
      
      if (success) {
        result = {
          success: true,
          message: `Successfully updated ${adminEmail} to Admin role`
        };
      } else {
        result = {
          success: false,
          message: `User with email ${adminEmail} not found or update failed`
        };
      }
    } catch (error) {
      console.error('Error updating user to admin:', error);
      result = {
        success: false,
        message: `Failed to update user: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      isUpdating = false;
    }
  }
  
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  async function fixGameGraphRelationships() {
    try {
      isFixingGames = true;
      gameFixResult = null;
      
      const result = await fixGameRelationships();
      
      if (result.success) {
        gameFixResult = {
          success: true,
          message: `Successfully fixed relationships for ${result.gamesFixed} games`
        };
        
        // Notify parent components to refresh the visualization
        dispatch('relationshipsFixed', { success: true });
        
      } else {
        gameFixResult = {
          success: false,
          message: `Failed to fix game relationships`
        };
      }
    } catch (error) {
      console.error('Error fixing game relationships:', error);
      gameFixResult = {
        success: false,
        message: `Error fixing game relationships: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      isFixingGames = false;
    }
  }
</script>

<div class="flex flex-col gap-8">
  <!-- User Management Section -->
  <div class="card p-4 bg-surface-50-900 rounded-container-token">
    <h3 class="h4 mb-4 flex items-center">
      <svelte:component this={icons.UserCog} class="w-5 h-5 mr-2 text-primary-500" />
      Admin User Management
    </h3>
    
    <p class="mb-4 text-surface-900-50">
      Use this tool to promote a user to Admin role. Enter the user's email address below.
    </p>
    
    <div class="input-group input-group-divider grid-cols-[1fr_auto] border-surface-400-500">
      <input 
        type="email"
        bind:value={adminEmail}
        placeholder="Enter user email"
        class="input bg-surface-100-800 text-surface-900-50"
      />
      <button 
        class="btn bg-primary-500 hover:bg-primary-600 text-white" 
        on:click={makeAdmin}
        disabled={isUpdating}
      >
        {#if isUpdating}
          <div class="spinner-third w-4 h-4 mr-2"></div>
          Updating...
        {:else}
          <svelte:component this={icons.ShieldCheck} class="w-4 h-4 mr-2" />
          Make Admin
        {/if}
      </button>
    </div>
    
    {#if result}
      <div class="alert {result.success ? 'bg-success-500 text-white' : 'bg-error-500 text-white'} mt-4 rounded-container-token">
        <svelte:component this={result.success ? icons.CheckCircle : icons.AlertTriangle} class="w-5 h-5" />
        <div class="alert-message">
          <h4 class="h5">{result.success ? 'Success' : 'Error'}</h4>
          <p>{result.message}</p>
        </div>
      </div>
    {/if}
  </div>
  
  <!-- Graph Visualization Tools Section -->
  <div class="card p-4 bg-surface-50-900 rounded-container-token">
    <h3 class="h4 mb-4 flex items-center">
      <svelte:component this={icons.Network} class="w-5 h-5 mr-2 text-primary-500" />
      Graph Visualization Tools
    </h3>
    
    <p class="mb-4 text-surface-900-50">
      These tools help manage the relationships between entities in the graph visualization.
    </p>
    
    <button 
      class="btn bg-primary-500 hover:bg-primary-600 text-white w-full sm:w-auto" 
      on:click={fixGameGraphRelationships}
      disabled={isFixingGames}
    >
      {#if isFixingGames}
        <div class="spinner-third w-4 h-4 mr-2"></div>
        Fixing Game Relationships...
      {:else}
        <svelte:component this={icons.GitMerge} class="w-4 h-4 mr-2" />
        Fix Game Relationships
      {/if}
    </button>
    
    <p class="text-xs text-surface-600-300 mt-2">
      This will create missing graph relationships for all games, allowing them to appear correctly in the visualization.
    </p>
    
    {#if gameFixResult}
      <div class="alert {gameFixResult.success ? 'bg-success-500 text-white' : 'bg-error-500 text-white'} mt-4 rounded-container-token">
        <svelte:component this={gameFixResult.success ? icons.CheckCircle : icons.AlertTriangle} class="w-5 h-5" />
        <div class="alert-message">
          <h4 class="h5">{gameFixResult.success ? 'Success' : 'Error'}</h4>
          <p>{gameFixResult.message}</p>
        </div>
      </div>
    {/if}
  </div>
</div>