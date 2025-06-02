<script lang="ts">
  import { updateUserRole } from '$lib/services/gameService';
  import { ShieldCheck, UserCog, CheckCircle, XCircle } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  
  let isUpdating = $state(false);
  let result = $state<{ success: boolean; message: string } | null>(null);
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
      
      const gun = window.gun;
      let foundUser = null;
      
      // Search through all users to find one with matching email
      const searchPromise = new Promise<any>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000);
        let userCount = 0;
        let checkedCount = 0;
        
        // First count total users
        gun.get('users').map().once((userData, userId) => {
          if (userData) userCount++;
        });
        
        // Then search through users
        gun.get('users').map().once((userData, userId) => {
          if (!userData) return;
          
          checkedCount++;
          
          // Check if this user has the email we're looking for
          if (userData.email === adminEmail) {
            clearTimeout(timeout);
            foundUser = { ...userData, userId };
            resolve(foundUser);
            return;
          }
          
          // If we've checked all users and found nothing
          if (checkedCount >= userCount) {
            clearTimeout(timeout);
            resolve(null);
          }
        });
        
        // Fallback timeout
        setTimeout(() => {
          if (!foundUser) {
            clearTimeout(timeout);
            resolve(null);
          }
        }, 3000);
      });
      
      const user = await searchPromise;
      
      if (!user || !user.user_id) {
        updateResult({
          success: false,
          message: `User with email ${adminEmail} not found`
        });
        return;
      }
      
      // Update the user's role to Admin
      await updateUserRole(user.user_id, 'Admin');
      
      updateResult({
        success: true,
        message: `Successfully updated ${adminEmail} to Admin role`
      });
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
  

</script>

<div class="flex flex-col gap-8">
  <!-- User Management Section -->
  <div class="card p-4 bg-surface-50-900 rounded-container-token">
    <h3 class="h4 mb-4 flex items-center">
      <UserCog class="w-5 h-5 mr-2 text-primary-500" />
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
          <ShieldCheck class="w-4 h-4 mr-2" />
          Make Admin
        {/if}
      </button>
    </div>
    
    {#if result}
      <div class="alert {result.success ? 'bg-success-500 text-white' : 'bg-error-500 text-white'} mt-4 rounded-container-token">
        {#if result.success}
          <CheckCircle class="w-5 h-5" />
        {:else}
          <XCircle class="w-5 h-5" />
        {/if}
        <div class="alert-message">
          <h4 class="h5">{result.success ? 'Success' : 'Error'}</h4>
          <p>{result.message}</p>
        </div>
      </div>
    {/if}
  </div>
  

</div>