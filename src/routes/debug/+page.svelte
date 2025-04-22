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
      
      // Check for the standard Gun.js pub format
      if (data && data.pub) {
        console.log('Public key found (standard format):', data.pub);
        results += `Public key found (standard format): ${data.pub}\n`;
        
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
      } 
      // Check for the non-standard format where the key is a property of the alias object
      else if (data) {
        // Look for properties that might be a pub key (usually long string with dots)
        const possiblePubKey = Object.keys(data).find(key => 
          key.includes('.') && key.length > 40
        );
        
        if (possiblePubKey) {
          console.log('Public key found (non-standard format):', possiblePubKey);
          results += `Public key found (non-standard format): ${possiblePubKey}\n`;
          results += `This indicates the user was created but not in the expected format.\n`;
          results += `This is likely why registration says "User already created" but doesn't appear in the database.\n`;
          
          // Try to access this user data
          gun.user(possiblePubKey).once((userData) => {
            console.log('User auth data (from non-standard format):', userData);
            results += `User auth data: ${JSON.stringify(userData)}\n`;
            loading = false;
          });
        } else {
          results += 'User record exists but no valid public key found\n';
          loading = false;
        }
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
    gun.get(`~@${email}`).once((data) => {
      if (data) {
        console.log('Found user data to clear:', data);
        results = `Found user data to clear: ${JSON.stringify(data)}\n`;
        
        // If we found a public key in the non-standard format
        const possiblePubKey = Object.keys(data).find(key => 
          key.includes('.') && key.length > 40
        );
        
        if (possiblePubKey) {
          // Attempt to clear references to this key
          gun.get(possiblePubKey).put(null);
          results += `Attempted to clear user with pub key: ${possiblePubKey}\n`;
        }
        
        // Clear the email alias
        gun.get(`~@${email}`).put(null);
        results += `Attempted to clear email alias: ~@${email}\n`;
        
        // If there's a pub field, clear that user in the public graph
        if (data.pub) {
          gun.get(`users/${data.pub}`).put(null);
          results += `Attempted to clear public user: users/${data.pub}\n`;
        }
      } else {
        results = `No user found with email: ${email}\n`;
      }
    });
  }
}

// Function to fix the user record format
function fixUserFormat() {
  if (confirm(`This will attempt to fix the user record format for ${email}. Continue?`)) {
    const gun = getGun();
    if (!gun) {
      results = 'Gun not initialized';
      return;
    }
    
    // First get the user record
    gun.get(`~@${email}`).once((data) => {
      if (data) {
        console.log('Found user data to fix:', data);
        results = `Found user data to fix: ${JSON.stringify(data)}\n`;
        
        // Look for a potential public key in the non-standard format
        const possiblePubKey = Object.keys(data).find(key => 
          key.includes('.') && key.length > 40
        );
        
        if (possiblePubKey) {
          // Update the alias to have a proper pub field
          gun.get(`~@${email}`).put({ pub: possiblePubKey });
          results += `Fixed email alias for ${email} with pub: ${possiblePubKey}\n`;
          
          // Also add a user entry in the public graph
          const userData = {
            user_id: possiblePubKey,
            name: email.split('@')[0],
            email,
            pub: possiblePubKey,
            role: 'Guest',
            created_at: Date.now()
          };
          
          gun.get(`users/${possiblePubKey}`).put(userData);
          results += `Created public user record: users/${possiblePubKey}\n`;
        } else {
          results += `No public key found to fix in user record\n`;
        }
      } else {
        results = `No user found with email: ${email}\n`;
      }
    });
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
      
      <div class="grid grid-cols-2 gap-2">
        <button 
          class="btn variant-filled-primary" 
          onclick={checkUserByEmail}
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Check User'}
        </button>
        
        <button 
          class="btn variant-filled-tertiary" 
          onclick={fixUserFormat}
        >
          Fix User Format
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