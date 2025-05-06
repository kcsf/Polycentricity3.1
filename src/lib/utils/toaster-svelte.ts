import { createToaster } from '@skeletonlabs/skeleton-svelte';

// Create a customized toaster with solid backgrounds
export const toaster = createToaster({
  duration: 4000, // 4 seconds
  classes: 'variant-filled', // Solid background
  background: 'variant-filled-surface', // Use surface color for solid background
});