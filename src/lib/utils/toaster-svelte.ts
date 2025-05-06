import { createToaster } from '@skeletonlabs/skeleton-svelte';

// Inject custom styles that specifically target the toast message elements
const styleElement = document.createElement('style');
styleElement.textContent = `
  /* Target all toast messages */
  [data-testid="toaster-message"],
  [data-part="toast"],
  div[role="status"],
  div[aria-live="polite"],
  .toast {
    background-color: rgb(var(--color-surface-100)) !important;
    --tw-bg-opacity: 1 !important;
    border: 1px solid rgb(var(--color-surface-200) / 0.3) !important;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
  }
  
  /* Dark mode specific styling */
  .dark [data-testid="toaster-message"],
  .dark [data-part="toast"],
  .dark div[role="status"],
  .dark div[aria-live="polite"],
  .dark .toast {
    background-color: rgb(var(--color-surface-900)) !important;
  }
`;
document.head.appendChild(styleElement);

// Create a simple toaster with base configuration
export const toaster = createToaster({
  duration: 5000
});
