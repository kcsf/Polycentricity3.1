import { writable } from 'svelte/store';
import IconWrapper from '../components/IconWrapper.svelte';
import type { ComponentType } from 'svelte';

interface IconData {
  name: string;
  component: ComponentType;
}

// Create a store to hold our icons
export const iconStore = writable<Map<string, IconData>>(new Map());

// Simplified loader that uses our wrapper component
export function loadIcons(iconNames: string[]) {
  let existingIcons: Map<string, IconData> = new Map();
  const unsubscribe = iconStore.subscribe(value => {
    existingIcons = value;
  });
  unsubscribe();

  const newIcons = new Map<string, IconData>(existingIcons);

  for (const name of iconNames) {
    if (newIcons.has(name)) continue;
    // All icons use the same wrapper component, with the name as a prop
    newIcons.set(name, { 
      name, 
      component: IconWrapper as unknown as ComponentType 
    });
  }

  if (newIcons.size > existingIcons.size) {
    iconStore.set(newIcons);
  }
}