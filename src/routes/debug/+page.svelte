<script lang="ts">
import { getGun } from '$lib/services/gunService';
import { onMount } from 'svelte';

let email = $state('casey@endogon.com');
let results = $state('');
let loading = $state(false);

onMount(() => {
  console.log('Debug page mounted');
});

async function checkUserByEmail() {
  loading = true;
  results = '';
  
  try {
    const gun = getGun();
    if (!gun) {
      results = 'Gun not initialized';
      loading = false;
      return;
    }
    
    console.log(`Checking user with email: ${email}`);
    results = `Checking user with email: ${email}\n`;
    
    // First check if the email is registered
    gun.get(`~@${email}`).once((data) => {
      console.log('User alias data:', data);
      results += `User alias data: ${JSON.stringify(data)}\n`;
      
      if (data && data.pub) {
        console.log('Public key found:', data.pub);
        results += `Public key found: ${data.pub}\n`;
        
        // Try to fetch the user's auth record
        gun.user(data.pub).once((userData) => {
          console.log('User auth data:', userData);
          results += `User auth data: ${JSON.stringify(userData)}\n`;
          
          // Try to get the user profile
          gun.user(data.pub).get('profile').once((profile) => {
            console.log('User profile:', profile);
            results += `User profile: ${JSON.stringify(profile)}\n`;
            loading = false;
          });
        });
      } else {
        results += 'No user found with this email\n';
        loading = false;
      }
    });
  } catch (error) {
    console.error('Error checking user:', error);
    results += `Error: ${error}\n`;
    loading = false;
  }
}

function resetLocalAuth() {
  if (confirm('This will clear all Gun authentication data from localStorage. Continue?')) {
    // Clear all authentication data from localStorage
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('gun/') || 
        key.includes('sea') || 
        key.startsWith('~@') || 
        key.startsWith('~')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    results = `Cleared ${keysToRemove.length} Gun-related items from localStorage\n`;
    
    // Reload the page to reinitialize Gun
    window.location.reload();
  }
}

function clearUser() {
  if (confirm(`This will attempt to clear the user with email ${email}. Continue?`)) {
    const gun = getGun();
    if (!gun) {
      results = 'Gun not initialized';
      return;
    }
    
    // Try to nullify the user record
    gun.get(`~@${email}`).put(null);
    results = `Attempted to clear user with email: ${email}\n`;
  }
}
</script>

<div class="container mx-auto p-4">
  <h1 class="h1 mb-4">Gun Database Debug</h1>
  
  <div class="card p-4 mb-6">
    <h2 class="h3 mb-2">Check User by Email</h2>
    <div class="grid grid-cols-1 gap-4">
      <label class="label">
        <span>Email</span>
        <input 
          type="text" 
          class="input" 
          value={email} 
          oninput={(e) => email = e.currentTarget.value}
        />
      </label>
      
      <div class="grid grid-cols-3 gap-2">
        <button 
          class="btn variant-filled-primary" 
          onclick={checkUserByEmail}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Check User'}
        </button>
        
        <button 
          class="btn variant-filled-warning" 
          onclick={clearUser}
        >
          Clear User
        </button>
        
        <button 
          class="btn variant-filled-error" 
          onclick={resetLocalAuth}
        >
          Reset All Auth
        </button>
      </div>
    </div>
  </div>
  
  <div class="card p-4">
    <h2 class="h3 mb-2">Results</h2>
    <pre class="bg-surface-700 p-4 rounded whitespace-pre-wrap overflow-auto max-h-96">
{results || 'No results yet'}
    </pre>
  </div>
</div>