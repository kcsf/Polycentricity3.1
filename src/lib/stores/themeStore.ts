import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Theme options
export type Theme = 'light' | 'dark';
const DEFAULT_THEME: Theme = 'light';
const STORAGE_KEY = 'polycentricity-theme-preference';

// Create the store
const themeStore = writable<Theme>(DEFAULT_THEME);

// Initialize theme from localStorage or default to light
function initializeTheme(): void {
  if (!browser) return;
  
  // Check localStorage for saved preference
  const storedTheme = localStorage.getItem(STORAGE_KEY);
  
  // Use system preference if no stored preference
  if (!storedTheme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    themeStore.set(prefersDark ? 'dark' : 'light');
    applyTheme(prefersDark ? 'dark' : 'light');
    return;
  }
  
  // Use stored preference if valid
  if (storedTheme === 'light' || storedTheme === 'dark') {
    themeStore.set(storedTheme as Theme);
    applyTheme(storedTheme as Theme);
  }
}

// Helper function to apply the theme using data-theme
function applyTheme(theme: Theme): void {
  if (!browser) return;
  
  // Use Skeleton UI's built-in mode handling with data-mode attribute
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-mode', 'dark');
  } else {
    document.documentElement.setAttribute('data-mode', 'light');
  }
  
  // Store the preference
  localStorage.setItem(STORAGE_KEY, theme);
}

// Initialize when on client side
if (browser) {
  initializeTheme();
  
  // Subscribe to store changes to apply the theme
  themeStore.subscribe(theme => {
    applyTheme(theme);
  });
}

// Toggle between light and dark
export function toggleTheme(): void {
  themeStore.update(current => {
    return current === 'light' ? 'dark' : 'light';
  });
}

export default themeStore;