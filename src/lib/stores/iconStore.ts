import { writable } from "svelte/store";
import { User } from "lucide-svelte";

// Map GunDB icon names to lucide-svelte names
// Add new mappings here for any new icons that don’t match lucide-svelte exactly
const iconNameMap: Record<string, string> = {
  // Common card icons we've seen in the database
  Hammer: "Hammer",
  CircleDollarSign: "CircleDollarSign", // Falls back to DollarSign if missing
  DollarSign: "DollarSign",
  sun: "Sun",
  link: "Link",
  lock: "Lock",
  users: "Users",
  user: "User",
  leaf: "Leaf",
  seedling: "Seedling",
  home: "Home",
  building: "Building",
  tree: "PalmTree",
  garden: "Flower2",
  plant: "Sprout",
  money: "Coins",
  coins: "Coins",
  default: "Box",
  
  // Card categories
  farmer: "Tractor",
  funder: "PiggyBank",
  steward: "Shield",
  investor: "TrendingUp"
};

interface IconData {
  name: string;
  component: any;
}

export const iconStore = writable<Map<string, IconData>>(new Map());

export async function loadIcons(iconNames: string[]) {
  // Get existing icons from the store
  let existingIcons: Map<string, IconData> = new Map<string, IconData>();
  
  // Subscribe to get current value then immediately unsubscribe
  const unsubscribe = iconStore.subscribe(value => {
    existingIcons = value;
  });
  unsubscribe();
  
  // Create a new map with existing icons
  const newIcons = new Map<string, IconData>(existingIcons);
  
  for (const name of iconNames) {
    // Skip if this icon is already loaded
    if (newIcons.has(name)) {
      console.log(`Icon ${name} already loaded, skipping`);
      continue;
    }
    
    const mappedName = iconNameMap[name] || name;
    const pascalName = mappedName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");

    try {
      const module = await import("lucide-svelte") as Record<string, any>;
      if (module[pascalName]) {
        // Reduced logging - only log in debug mode
        if (process.env.NODE_ENV === 'development' && false) { // Disable even in dev
          console.log(`Loaded icon ${name} as ${pascalName} from lucide-svelte`);
        }
        newIcons.set(name, { name, component: module[pascalName] });
      } else {
        // Special case for CircleDollarSign
        if (pascalName === "Circledollarsign") {
          if (module.DollarSign) {
            newIcons.set(name, { name, component: module.DollarSign });
            // Disabled verbose logging
          } else {
            throw new Error("DollarSign fallback not found");
          }
        } else {
          throw new Error(`${pascalName} not found in lucide-svelte`);
        }
      }
    } catch (error) {
      // Only log the error message, not the full error object
      console.warn(`Failed to load icon ${pascalName} for ${name}, using User fallback`);
      newIcons.set(name, { name, component: User });
    }
  }
  
  // Only update if we loaded new icons
  if (newIcons.size > existingIcons.size) {
    console.log("Icon store updated with:", [...newIcons.keys()]);
    iconStore.set(newIcons);
  }
}
