<script lang="ts">
  import hljs from 'highlight.js';
  import 'highlight.js/styles/atom-one-dark.css';
  import { onMount } from 'svelte';
  
  // Props
  const { code, language = 'typescript' } = $props<{ 
    code: string;
    language?: string;
  }>();
  
  // State
  let highlighted = $state('');
  let codeElement = $state<HTMLElement | null>(null);
  
  // Highlight code on mount and when code changes
  $effect(() => {
    if (code) {
      try {
        highlighted = hljs.highlight(code, { language }).value;
      } catch (e) {
        // Fallback if language not supported
        highlighted = hljs.highlightAuto(code).value;
      }
    }
  });
  
  // Apply highlighting after the DOM is ready
  onMount(() => {
    if (codeElement) {
      hljs.highlightBlock(codeElement);
    }
  });
</script>

<div class="code-block font-mono text-xs rounded overflow-hidden">
  <pre class="p-3 bg-surface-800 text-surface-200 overflow-x-auto">
    <code 
      class="language-{language}" 
      bind:this={codeElement}
    >{@html highlighted}</code>
  </pre>
</div>

<style>
  .code-block {
    position: relative;
    margin: 0.5rem 0;
  }
  
  pre {
    tab-size: 2;
  }
  
  code {
    font-family: inherit;
    white-space: pre-wrap;
  }
</style>