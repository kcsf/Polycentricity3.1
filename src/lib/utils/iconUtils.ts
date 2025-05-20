// src/lib/utils/iconUtils.ts
import type { Component } from 'svelte';
// import every icon once — Vite will tree-shake unused ones
import * as Lucide from '@lucide/svelte';

const iconMap: Record<string, Component> = Object.entries(Lucide).reduce(
  (m, [exportName, comp]) => {
    m[exportName.toLowerCase()] = comp as Component;
    return m;
  },
  {} as Record<string, Component>
);

/**
 * Get the Lucide icon component for the given name (case-insensitive).
 * Falls back to Circle if not found or no name provided.
 */
export function getIconComponent(iconName?: string): Component {
  if (!iconName) {
    return iconMap['circle'];
  }
  const key = iconName.toLowerCase();
  return iconMap[key] ?? iconMap['circle'];
}
