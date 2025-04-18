<script lang="ts">
  // Simple code block component for displaying code examples
  // This helps to avoid Svelte trying to parse code examples as actual template code
  
  // Props
  const { code = '', language = 'typescript' } = $props<{
    code?: string;
    language?: string;
  }>();
</script>

<div class="code-block bg-surface-800 text-white p-3 rounded-md font-mono text-sm whitespace-pre-wrap overflow-x-auto">
  {code}
</div>

<style>
  .code-block {
    tab-size: 2;
  }
</style>