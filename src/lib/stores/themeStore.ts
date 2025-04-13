import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Theme options
export type Theme = 'light' | 'dark';
const DEFAULT_THEME: Theme = 'light';
const STORAGE_KEY = 'polycentricity-theme-preference';

// Initialize theme from localStorage or default to light
function initializeTheme(): Theme {
  if (!browser) return DEFAULT_THEME;
  
  // Check localStorage for saved preference
  const storedTheme = localStorage.getItem(STORAGE_KEY);
  
  // Check system preference if no stored preference
  if (!storedTheme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }
  
  // Use stored preference if valid
  const validTheme = storedTheme === 'light' || storedTheme === 'dark' 
    ? storedTheme as Theme 
    : DEFAULT_THEME;
    
  // Apply the theme to the HTML tag when initializing
  applyTheme(validTheme);
  
  return validTheme;
}

// Helper function to apply the theme to the HTML element
function applyTheme(theme: Theme): void {
  if (!browser) return;
  
  // Use Skeleton UI's full theming system
  if (theme === 'dark') {
    // Apply dark mode - skeleton theme
    document.documentElement.setAttribute('data-theme', 'skeleton');
    document.documentElement.classList.add('dark');
  } else {
    // Apply light mode - fennec theme
    document.documentElement.setAttribute('data-theme', 'fennec');
    document.documentElement.classList.remove('dark');
  }
  
  // Store the preference
  localStorage.setItem(STORAGE_KEY, theme);
}

// Create the store
const themeStore = writable<Theme>(DEFAULT_THEME);

// Initialize the store when in browser
if (browser) {
  themeStore.set(initializeTheme());
}

// Subscribe to the store to apply changes
if (browser) {
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