<script>
  import { onMount } from 'svelte';
  
  const resetCode = `
// 1. Drop Radisk / Gun IndexedDB stores:
indexedDB.deleteDatabase('radisk');
indexedDB.deleteDatabase('gun');
indexedDB.deleteDatabase('radata');

// 2. Clear any Gun‐related localStorage entries:
localStorage.removeItem('gun');           // the default Gun cache key
localStorage.removeItem('gun/user');      // stored user session

// Find all Gun-related localStorage keys
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (
    key.startsWith('gun/') || 
    key.includes('sea') || 
    key.startsWith('~@') || 
    key.startsWith('~') ||
    key.includes('iris.') ||
    key.includes('PEER') ||
    key.includes('ALLOW')
  )) {
    keysToRemove.push(key);
  }
}

// Remove all identified Gun-related keys
keysToRemove.forEach(key => localStorage.removeItem(key));
console.log('Removed ' + keysToRemove.length + ' Gun-related localStorage items');

// 3. Clear session storage completely
sessionStorage.clear();
console.log('Session storage cleared');

// 4. Reload the page
console.log('Database reset complete! Reloading page...');
window.location.reload();`;

  function copyToClipboard() {
    navigator.clipboard.writeText(resetCode).then(() => {
      alert('Reset code copied to clipboard!');
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }
</script>

<div class="container mx-auto p-4 max-w-4xl">
  <h1 class="h1">Emergency Gun.js Database Reset</h1>
  
  <div class="card p-4 my-4">
    <h2 class="h3">Reset Instructions</h2>
    <ol class="list">
      <li class="py-2">Open your browser developer console (F12 or right-click > Inspect > Console tab)</li>
      <li class="py-2">Copy the code below</li>
      <li class="py-2">Paste it into the console and press Enter</li>
      <li class="py-2">The page will automatically reload with a fresh database</li>
    </ol>
  </div>
  
  <div class="card p-4 my-4">
    <div class="flex justify-between items-center mb-4">
      <h2 class="h3">Reset Code</h2>
      <button class="btn variant-filled-primary" onclick={copyToClipboard}>Copy to Clipboard</button>
    </div>
    
    <pre class="bg-surface-700 p-4 rounded whitespace-pre-wrap font-mono text-sm">
{resetCode}
    </pre>
  </div>
  
  <div class="card p-4 my-4 variant-ghost-warning">
    <h3 class="h4">⚠️ Warning</h3>
    <p>This will completely erase your Gun.js database, including all user accounts and application data. This action cannot be undone!</p>
  </div>
  
  <div class="flex gap-4 justify-center mt-8">
    <a href="/reset" class="btn variant-filled-error">Go to Complete Reset Tool</a>
    <a href="/" class="btn variant-ghost-surface">Return to Home</a>
  </div>
</div>