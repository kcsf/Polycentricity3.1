<script>
// Simplified layout for admin to avoid Tailwind/Skeleton UI issues
</script>

<div>
  <slot />
</div>

<style>
  :global(body) {
    font-family: system-ui, sans-serif;
    line-height: 1.5;
    margin: 0;
    padding: 0;
  }
  
  :global(a) {
    color: #3273dc;
    text-decoration: none;
  }
  
  :global(a:hover) {
    text-decoration: underline;
  }
  
  :global(pre) {
    background: #f5f5f5;
    padding: 0.5rem;
    border-radius: 0.25rem;
    overflow-x: auto;
  }
  
  :global(button) {
    cursor: pointer;
    padding: 0.5rem 1rem;
    background-color: #3273dc;
    color: white;
    border: none;
    border-radius: 0.25rem;
    font-weight: 500;
  }
  
  :global(button:hover) {
    background-color: #2366d1;
  }
  
  :global(button:disabled) {
    background-color: #b5b5b5;
    cursor: not-allowed;
  }
  
  :global(.tab-button) {
    background-color: #f5f5f5;
    color: #4a4a4a;
    border: 1px solid #dbdbdb;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    margin-right: 0.25rem;
  }
  
  :global(.tab-button.active) {
    background-color: white;
    color: #3273dc;
    border-bottom: 2px solid #3273dc;
  }
</style>