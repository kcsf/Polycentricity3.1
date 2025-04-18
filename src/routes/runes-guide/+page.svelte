<script lang="ts">
  import SvelteRunesGuide from '$lib/components/guides/SvelteRunesGuide.svelte';
  import * as icons from 'lucide-svelte';
</script>

<div class="container mx-auto p-4 md:p-8">
  <div class="mb-6 flex justify-between items-center">
    <div>
      <h1 class="h1 text-primary-500 mb-2">Svelte 5 Runes Guide</h1>
      <p class="text-surface-600 dark:text-surface-400">
        Best practices and patterns for Svelte 5.25.9 Runes mode in Polycentricity3
      </p>
    </div>
    <a href="/admin" class="btn variant-ghost-surface">
      <icons.ArrowLeft class="h-4 w-4 mr-2" />
      Back to Admin
    </a>
  </div>
  
  <div class="card p-4 variant-soft">
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0">
        <icons.Info class="text-primary-500" />
      </div>
      <div>
        <h3 class="h4 mb-1">About This Guide</h3>
        <p class="text-sm">
          This guide shows the recommended patterns for working with Svelte 5.25.9 in Runes mode. 
          Runes mode introduces a new reactive programming model that replaces Svelte 4's reactive 
          declarations ($:) with explicit reactive primitives ($state, $derived, $effect).
          For Gun.js integration, we recommend specific patterns to avoid state_unsafe_mutation errors.
        </p>
      </div>
    </div>
  </div>
  
  <div class="mt-6">
    <SvelteRunesGuide />
  </div>
</div>