// src/lib/stores/themeStore.ts
import { writable } from "svelte/store";
import { browser } from "$app/environment";

// Theme options
export type Theme = "light" | "dark";
const DEFAULT_THEME: Theme = "light";
const STORAGE_KEY = "polycentricity-theme-preference";

// Create the store
const themeStore = writable<Theme>(DEFAULT_THEME);

// Initialize theme from localStorage or browser preference
function initializeTheme(): void {
  if (!browser) return;

  // Check localStorage for saved preference
  const storedTheme = localStorage.getItem(STORAGE_KEY);
  console.log(`themeStore: Initializing theme - storedTheme: ${storedTheme}`);

  if (storedTheme === "light" || storedTheme === "dark") {
    console.log(`themeStore: Applying stored theme: ${storedTheme}`);
    themeStore.set(storedTheme as Theme);
    applyTheme(storedTheme as Theme);
  } else {
    // Default to browser preference if no stored theme
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const initialTheme = prefersDark ? "dark" : "light";
    console.log(
      `themeStore: No stored theme, using browser preference: ${initialTheme} (prefersDark: ${prefersDark})`,
    );
    themeStore.set(initialTheme);
    applyTheme(initialTheme);
  }
}

// Apply the theme to the HTML element
function applyTheme(theme: Theme): void {
  if (!browser) return;

  const htmlElement = document.documentElement;

  // First, remove all scheme-related classes to start fresh
  htmlElement.classList.remove("dark", "light", "scheme-dark", "scheme-light", "scheme-only-dark", "scheme-only-light");
  
  // Now add the appropriate classes for Tailwind 4
  if (theme === "dark") {
    // Add both the legacy 'dark' class and new Tailwind 4 scheme classes
    htmlElement.classList.add("dark");
    htmlElement.classList.add("scheme-dark");
    // Force dark mode regardless of media queries (prevents auto-switching)
    htmlElement.classList.add("scheme-only-dark");
    
    // Also set the color-scheme CSS property for browser controls
    htmlElement.style.colorScheme = "dark";
    
    console.log(
      "themeStore: Applied dark mode with Tailwind 4 scheme classes",
    );
    console.log(`themeStore: HTML classList: ${htmlElement.classList}`);
  } else {
    // Add light theme classes for Tailwind 4
    htmlElement.classList.add("light");
    htmlElement.classList.add("scheme-light");
    // Force light mode regardless of media queries
    htmlElement.classList.add("scheme-only-light");
    
    // Also set the color-scheme CSS property for browser controls
    htmlElement.style.colorScheme = "light";
    
    console.log(
      "themeStore: Applied light mode with Tailwind 4 scheme classes",
    );
    console.log(`themeStore: HTML classList: ${htmlElement.classList}`);
  }

  // Store the preference
  localStorage.setItem(STORAGE_KEY, theme);

  // Debug Skeleton UI variables after applying theme
  const rootStyle = getComputedStyle(document.documentElement);
  const surface50 = rootStyle
    .getPropertyValue("--theme-color-surface-50")
    .trim();
  const surface900 = rootStyle
    .getPropertyValue("--theme-color-surface-900")
    .trim();
  console.log(
    `themeStore: After applying ${theme} mode - surface-50: ${surface50}, surface-900: ${surface900}`,
  );
}

// Initialize theme on client side
if (browser) {
  initializeTheme();

  // Subscribe to store changes to apply the theme
  themeStore.subscribe((theme) => {
    applyTheme(theme);
  });

  // Listen for changes in prefers-color-scheme and update if no stored preference
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      const storedTheme = localStorage.getItem(STORAGE_KEY);
      if (!storedTheme) {
        const newTheme = e.matches ? "dark" : "light";
        console.log(
          `themeStore: System preference changed to ${newTheme}, applying since no stored theme`,
        );
        themeStore.set(newTheme);
      }
    });
}

// Toggle between light and dark
export function toggleTheme(): void {
  themeStore.update((current) => {
    console.log("themeStore: Current theme:", current);
    const newTheme = current === "light" ? "dark" : "light";
    console.log("themeStore: Switching to theme:", newTheme);
    return newTheme;
  });
}

export default themeStore;
