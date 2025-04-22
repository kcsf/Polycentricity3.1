<script lang="ts">
  import { updateUserToAdmin } from '$lib/services/authService';
  import { fixGameRelationships } from '$lib/services/gameService';
  import * as icons from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  
  let isUpdating = $state(false);
  let isFixingGames = $state(false);
  let result = $state<{ success: boolean; message: string } | null>(null);
  let gameFixResult = $state<{ success: boolean; message: string } | null>(null);
  let adminEmail = $state('');
  
  const dispatch = createEventDispatcher();
  
  // Helper function to update state objects
  function updateResult(newResult: { success: boolean; message: string } | null) {
    if (newResult === null) {
      // Simply reassign result to null - it's now a 'let' variable
      result = null;
      return;
    }
    
    // Create a new object for the result
    result = {
      success: newResult.success,
      message: newResult.message
    };
  }
  
  async function makeAdmin() {
    if (!adminEmail.trim()) {
      updateResult({
        success: false,
        message: 'Please enter an email address'
      });
      return;
    }
    
    try {
      isUpdating = true;
      updateResult(null);
      
      const success = await updateUserToAdmin(adminEmail);
      
      if (success) {
        updateResult({
          success: true,
          message: `Successfully updated ${adminEmail} to Admin role`
        });
      } else {
        updateResult({
          success: false,
          message: `User with email ${adminEmail} not found or update failed`
        });
      }
    } catch (error) {
      console.error('Error updating user to admin:', error);
      updateResult({
        success: false,
        message: `Failed to update user: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      isUpdating = false;
    }
  }
  
  // Helper function to update gameFixResult
  function updateGameFixResult(newResult: { success: boolean; message: string } | null) {
    if (newResult === null) {
      // Simply reassign gameFixResult to null - it's now a 'let' variable
      gameFixResult = null;
      return;
    }
    
    // Create a new object for the gameFixResult
    gameFixResult = {
      success: newResult.success,
      message: newResult.message
    };
  }
  
  async function fixGameGraphRelationships() {
    try {
      isFixingGames = true;
      updateGameFixResult(null);
      
      const response = await fixGameRelationships();
      
      if (response.success) {
        updateGameFixResult({
          success: true,
          message: `Successfully fixed relationships for ${response.gamesFixed} games`
        });
        
        // Notify parent components to refresh the visualization
        dispatch('relationshipsFixed', { success: true });
        
      } else {
        updateGameFixResult({
          success: false,
          message: `Failed to fix game relationships`
        });
      }
    } catch (error) {
      console.error('Error fixing game relationships:', error);
      updateGameFixResult({
        success: false,
        message: `Error fixing game relationships: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      isFixingGames = false;
    }
  }
</script>

<div class="flex flex-col gap-8">
  <!-- User Management Section -->
  <div class="card p-4 bg-surface-50-900 rounded-container-token">
    <h3 class="h4 mb-4 flex items-center">
      {icons.UserCog && icons.UserCog({ class: "w-5 h-5 mr-2 text-primary-500" })}
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
        onclick={makeAdmin}
        disabled={isUpdating}
      >
        {#if isUpdating}
          <div class="spinner-third w-4 h-4 mr-2"></div>
          Updating...
        {:else}
          {icons.ShieldCheck && icons.ShieldCheck({ class: "w-4 h-4 mr-2" })}
          Make Admin
        {/if}
      </button>
    </div>
    
    {#if result}
      <div class="alert {result.success ? 'bg-success-500 text-white' : 'bg-error-500 text-white'} mt-4 rounded-container-token">
        {result.success 
          ? (icons.CheckCircle && icons.CheckCircle({ class: "w-5 h-5" }))
          : (icons.AlertTriangle && icons.AlertTriangle({ class: "w-5 h-5" }))
        }
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
      {icons.Network && icons.Network({ class: "w-5 h-5 mr-2 text-primary-500" })}
      Graph Visualization Tools
    </h3>
    
    <p class="mb-4 text-surface-900-50">
      These tools help manage the relationships between entities in the graph visualization.
    </p>
    
    <button 
      class="btn bg-primary-500 hover:bg-primary-600 text-white w-full sm:w-auto" 
      onclick={fixGameGraphRelationships}
      disabled={isFixingGames}
    >
      {#if isFixingGames}
        <div class="spinner-third w-4 h-4 mr-2"></div>
        Fixing Game Relationships...
      {:else}
        {icons.GitMerge && icons.GitMerge({ class: "w-4 h-4 mr-2" })}
        Fix Game Relationships
      {/if}
    </button>
    
    <p class="text-xs text-surface-600-300 mt-2">
      This will create missing graph relationships for all games, allowing them to appear correctly in the visualization.
    </p>
    
    {#if gameFixResult}
      <div class="alert {gameFixResult.success ? 'bg-success-500 text-white' : 'bg-error-500 text-white'} mt-4 rounded-container-token">
        {gameFixResult.success 
          ? (icons.CheckCircle && icons.CheckCircle({ class: "w-5 h-5" }))
          : (icons.AlertTriangle && icons.AlertTriangle({ class: "w-5 h-5" }))
        }
        <div class="alert-message">
          <h4 class="h5">{gameFixResult.success ? 'Success' : 'Error'}</h4>
          <p>{gameFixResult.message}</p>
        </div>
      </div>
    {/if}
  </div>
</div>