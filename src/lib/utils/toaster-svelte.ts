import { createToaster } from '@skeletonlabs/skeleton-svelte';

// Create a custom CSS class for our toast
// We'll add this to our app.css file or include it inline here
const style = document.createElement('style');
style.textContent = `
  .solid-toast {
    --tw-bg-opacity: 1 !important;
    background-color: rgb(var(--color-surface-100) / var(--tw-bg-opacity)) !important;
    border: 1px solid rgb(var(--color-surface-200) / 0.3);
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }
  .dark .solid-toast {
    background-color: rgb(var(--color-surface-900) / var(--tw-bg-opacity)) !important;
  }
`;
document.head.appendChild(style);

// Create the toaster with our custom class
export const toaster = createToaster({
  duration: 6000,
  classes: 'solid-toast text-surface-900-50 font-medium',
});
