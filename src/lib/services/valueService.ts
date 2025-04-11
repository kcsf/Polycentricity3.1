// Value management service
import { getGun, nodes, generateId, put, get } from "./gunService";
import type { Value } from "$lib/types";

// Create or get a value
export async function createValue(name: string): Promise<Value | null> {
    console.log(`[createValue] Processing: ${name}`);
    const gun = getGun();
    if (!gun) {
        console.error("[createValue] Gun not initialized");
        return null;
    }

    const valueId = `value_${name.toLowerCase().replace(/\s+/g, "-")}`;
    const valueData: Value = {
        value_id: valueId,
        name,
        created_at: Date.now(),
    };

    const existing = await get(`${nodes.values}/${valueId}`);
    if (existing?.value_id) {
        console.log(`[createValue] Reusing: ${valueId}`);
        return existing as Value;
    }

    try {
        await put(`${nodes.values}/${valueId}`, valueData);
        console.log(`[createValue] Created: ${valueId}`);
        return valueData;
    } catch (error) {
        console.error("[createValue] Error:", error);
        return null;
    }
}

// Get all values
export async function getAllValues(): Promise<Value[]> {
    console.log("[getAllValues] Fetching all values");
    const gun = getGun();
    if (!gun) return [];

    const values: Value[] = [];
    await new Promise<void>((resolve) => {
        gun.get(nodes.values)
            .map()
            .once((data: Value) => {
                if (data) values.push(data);
            });
        setTimeout(resolve, 500);
    });
    console.log(`[getAllValues] Found ${values.length} values`);
    return values;
}
