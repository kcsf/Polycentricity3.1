<script lang="ts">
  // Simple code block component with syntax highlighting
  const { code } = $props<{ code: string }>();
</script>

<div class="code-block font-mono text-xs rounded overflow-hidden">
  <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto whitespace-pre-wrap">{code}</pre>
</div>

<style>
  .code-block {
    position: relative;
    margin: 0.5rem 0;
  }
  
  pre {
    tab-size: 2;
  }
</style>