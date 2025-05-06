import { createToaster } from "@skeletonlabs/skeleton-svelte";

// Create a simple toaster - styles are defined in toast-override.css
export const toaster = createToaster({
  duration: 20000,
});
