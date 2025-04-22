import { writable } from 'svelte/store';
import { CircleDollarSign } from '@lucide/svelte';
import type { ComponentType } from 'svelte';

// Map GunDB icon names to @lucide/svelte names
const iconNameMap: Record<string, string> = {
  Hammer: 'Hammer',
  CircleDollarSign: 'CircleDollarSign',
  DollarSign: 'DollarSign',
  sun: 'Sun',
  link: 'Link',
  lock: 'Lock',
  users: 'Users',
  user: 'User',
  leaf: 'Leaf',
  seedling: 'Seedling',
  home: 'Home',
  building: 'Building',
  tree: 'PalmTree',
  garden: 'Flower2',
  plant: 'Sprout',
  money: 'Coins',
  coins: 'Coins',
  default: 'Box',
  farmer: 'Tractor',
  funder: 'PiggyBank',
  steward: 'Shield',
  investor: 'TrendingUp'
};

interface IconData {
  name: string;
  component: ComponentType;
}

export const iconStore = writable<Map<string, IconData>>(new Map());

export async function loadIcons(iconNames: string[]) {
  let existingIcons: Map<string, IconData> = new Map();
  const unsubscribe = iconStore.subscribe(value => {
    existingIcons = value;
  });
  unsubscribe();

  const newIcons = new Map<string, IconData>(existingIcons);

  for (const name of iconNames) {
    if (newIcons.has(name)) continue;

    const mappedName = iconNameMap[name] || name;
    const pascalName = mappedName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    try {
      const module = await import('@lucide/svelte');
      const iconComponent = module[pascalName] as ComponentType;
      if (iconComponent) {
        newIcons.set(name, { name, component: iconComponent });
      } else if (pascalName === 'Circledollarsign') {
        if (module.DollarSign) {
          newIcons.set(name, { name, component: module.DollarSign as ComponentType });
        } else {
          throw new Error('DollarSign fallback not found');
        }
      } else {
        throw new Error(`${pascalName} not found in @lucide/svelte`);
      }
    } catch (error) {
      console.warn(`Failed to load icon ${pascalName} for ${name}, using fallback`);
      newIcons.set(name, { name, component: CircleDollarSign });
    }
  }

  if (newIcons.size > existingIcons.size) {
    iconStore.set(newIcons);
  }
}