import { writable } from "svelte/store";
import { User } from "svelte-lucide";

// Map GunDB icon names to svelte-lucide names
// Add new mappings here for any new icons that don’t match svelte-lucide exactly
const iconNameMap: Record<string, string> = {
  Hammer: "Hammer",
  CircleDollarSign: "CircleDollarSign", // Falls back to DollarSign if missing
  sun: "Sun",
  link: "Link",
  lock: "Lock",
  users: "Users",
};

interface IconData {
  name: string;
  component: any;
}

export const iconStore = writable<Map<string, IconData>>(new Map());

export async function loadIcons(iconNames: string[]) {
  const newIcons = new Map<string, IconData>();
  for (const name of iconNames) {
    const mappedName = iconNameMap[name] || name;
    const pascalName = mappedName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");

    try {
      const module = await import("svelte-lucide");
      if (module[pascalName]) {
        console.log(`Loaded icon ${name} as ${pascalName} from svelte-lucide`);
        newIcons.set(name, { name, component: module[pascalName] });
      } else {
        // Special case for CircleDollarSign
        if (pascalName === "Circledollarsign") {
          console.log(
            `CircleDollarSign not found, trying DollarSign for ${name}`,
          );
          if (module.DollarSign) {
            newIcons.set(name, { name, component: module.DollarSign });
            console.log(`Used DollarSign for ${name}`);
          } else {
            throw new Error("DollarSign fallback not found");
          }
        } else {
          throw new Error(`${pascalName} not found in svelte-lucide`);
        }
      }
    } catch (error) {
      console.warn(
        `Failed to load icon ${pascalName} for ${name}, using User:`,
        error,
      );
      newIcons.set(name, { name, component: User });
    }
  }
  console.log("Icon store updated with:", [...newIcons.keys()]);
  iconStore.set(newIcons);
}
