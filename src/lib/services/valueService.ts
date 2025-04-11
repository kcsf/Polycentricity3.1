// Value management service
import {
    getGun,
    nodes,
    generateId,
    put,
    get,
    getCollection,
} from "./gunService";
import type { Value } from "$lib/types";

// Create a new value
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

// Get a value by ID
export async function getValue(valueId: string): Promise<Value | null> {
    console.log(`[getValue] Fetching: ${valueId}`);
    const gun = getGun();
    if (!gun) {
        console.error("[getValue] Gun not initialized");
        return null;
    }

    const valueData = await get(`${nodes.values}/${valueId}`);
    if (!valueData) {
        console.log(`[getValue] Not found: ${valueId}`);
        return null;
    }
    console.log(`[getValue] Found: ${valueId}`);
    return valueData as Value;
}

// Get all values
export async function getAllValues(): Promise<Value[]> {
    console.log("[getAllValues] Fetching all values");
    const values = await getCollection<Value>(nodes.values);
    console.log(`[getAllValues] Found ${values.length} values`);
    return values;
}

// Update a value
export async function updateValue(
    valueId: string,
    updates: Partial<Value>,
): Promise<boolean> {
    console.log(`[updateValue] Updating ${valueId} with`, updates);
    try {
        await put(`${nodes.values}/${valueId}`, updates);
        console.log(`[updateValue] Updated: ${valueId}`);
        return true;
    } catch (error) {
        console.error("[updateValue] Error:", error);
        return false;
    }
}

// Delete a value
export async function deleteValue(valueId: string): Promise<boolean> {
    console.log(`[deleteValue] Deleting ${valueId}`);
    try {
        await put(`${nodes.values}/${valueId}`, null);
        console.log(`[deleteValue] Deleted: ${valueId}`);
        return true;
    } catch (error) {
        console.error("[deleteValue] Error:", error);
        return false;
    }
}

// Create or get values from an array of names
export async function createOrGetValues(
    valueNames: string[],
): Promise<Record<string, boolean>> {
    console.log(`[createOrGetValues] Processing ${valueNames.length} values`);
    const valueMap: Record<string, boolean> = {};

    for (const name of valueNames.filter(Boolean)) {
        const value = await createValue(name.trim());
        if (value) {
            valueMap[value.value_id] = true;
            console.log(`[createOrGetValues] Added: ${value.value_id}`);
        }
    }

    console.log(
        `[createOrGetValues] Processed ${Object.keys(valueMap).length} values`,
    );
    return valueMap;
}
