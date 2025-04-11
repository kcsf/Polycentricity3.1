<script>
// Simple layout without Tailwind or Skeleton UI dependencies
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
  
  :global(pre) {
    background: #f5f5f5;
    padding: 0.5rem;
    border-radius: 0.25rem;
    overflow-x: auto;
  }
</style>