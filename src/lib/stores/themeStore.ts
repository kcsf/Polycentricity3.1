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

// Helper function to apply the theme directly to the HTML element (Skeleton approach)
function applyTheme(theme: Theme): void {
  if (!browser) return;
  
  // Get the HTML element (root element for dark mode in Skeleton)
  const htmlElement = document.documentElement;
  
  if (theme === 'dark') {
    // Add dark class to html element (this is how Skeleton UI works)
    htmlElement.classList.add('dark');
    
    // Explicitly set color-scheme to override prefers-color-scheme
    htmlElement.style.colorScheme = 'dark';
    console.log('Applied dark class to HTML element with color-scheme:dark');
  } else {
    // Remove dark class from html element
    htmlElement.classList.remove('dark');
    
    // Explicitly set color-scheme to light to override prefers-color-scheme
    htmlElement.style.colorScheme = 'light';
    console.log('Removed dark class from HTML element with color-scheme:light');
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
    console.log('Current theme:', current);
    const newTheme = current === 'light' ? 'dark' : 'light';
    console.log('Switching to theme:', newTheme);
    return newTheme;
  });
}

export default themeStore;