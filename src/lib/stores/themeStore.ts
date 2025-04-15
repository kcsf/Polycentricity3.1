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

  if (storedTheme === "light" || storedTheme === "dark") {
    themeStore.set(storedTheme as Theme);
    applyTheme(storedTheme as Theme);
  } else {
    // Default to browser preference if no stored theme
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const initialTheme = prefersDark ? "dark" : "light";
    themeStore.set(initialTheme);
    applyTheme(initialTheme);
  }
}

// Apply the theme to the HTML element
function applyTheme(theme: Theme): void {
  if (!browser) return;

  const htmlElement = document.documentElement;

  if (theme === "dark") {
    htmlElement.classList.add("dark");
    htmlElement.style.colorScheme = "dark";
  } else {
    htmlElement.classList.remove("dark");
    htmlElement.style.colorScheme = "light";
  }

  // Store the preference
  localStorage.setItem(STORAGE_KEY, theme);

  // Store preference without debugging logs
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
        themeStore.set(newTheme);
      }
    });
}

// Toggle between light and dark
export function toggleTheme(): void {
  themeStore.update((current) => {
    const newTheme = current === "light" ? "dark" : "light";
    return newTheme;
  });
}

export default themeStore;
