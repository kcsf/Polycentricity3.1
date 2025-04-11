// Capability management service
import {
    getGun,
    nodes,
    generateId,
    put,
    get,
    getCollection,
} from "./gunService";
import type { Capability } from "$lib/types";

// Create a new capability
export async function createCapability(
    name: string,
): Promise<Capability | null> {
    console.log(`[createCapability] Processing: ${name}`);
    const gun = getGun();
    if (!gun) {
        console.error("[createCapability] Gun not initialized");
        return null;
    }

    const capabilityId = `capability_${name.toLowerCase().replace(/\s+/g, "-")}`;
    const capData: Capability = {
        capability_id: capabilityId,
        name,
        created_at: Date.now(),
    };

    const existing = await get(`${nodes.capabilities}/${capabilityId}`);
    if (existing?.capability_id) {
        console.log(`[createCapability] Reusing: ${capabilityId}`);
        return existing as Capability;
    }

    try {
        await put(`${nodes.capabilities}/${capabilityId}`, capData);
        console.log(`[createCapability] Created: ${capabilityId}`);
        return capData;
    } catch (error) {
        console.error("[createCapability] Error:", error);
        return null;
    }
}

// Get a capability by ID
export async function getCapability(
    capabilityId: string,
): Promise<Capability | null> {
    console.log(`[getCapability] Fetching: ${capabilityId}`);
    const gun = getGun();
    if (!gun) {
        console.error("[getCapability] Gun not initialized");
        return null;
    }

    const capData = await get(`${nodes.capabilities}/${capabilityId}`);
    if (!capData) {
        console.log(`[getCapability] Not found: ${capabilityId}`);
        return null;
    }
    console.log(`[getCapability] Found: ${capabilityId}`);
    return capData as Capability;
}

// Get all capabilities
export async function getAllCapabilities(): Promise<Capability[]> {
    console.log("[getAllCapabilities] Fetching all capabilities");
    const caps = await getCollection<Capability>(nodes.capabilities);
    console.log(`[getAllCapabilities] Found ${caps.length} capabilities`);
    return caps;
}

// Update a capability
export async function updateCapability(
    capabilityId: string,
    updates: Partial<Capability>,
): Promise<boolean> {
    console.log(`[updateCapability] Updating ${capabilityId} with`, updates);
    try {
        await put(`${nodes.capabilities}/${capabilityId}`, updates);
        console.log(`[updateCapability] Updated: ${capabilityId}`);
        return true;
    } catch (error) {
        console.error("[updateCapability] Error:", error);
        return false;
    }
}

// Delete a capability
export async function deleteCapability(capabilityId: string): Promise<boolean> {
    console.log(`[deleteCapability] Deleting ${capabilityId}`);
    try {
        await put(`${nodes.capabilities}/${capabilityId}`, null);
        console.log(`[deleteCapability] Deleted: ${capabilityId}`);
        return true;
    } catch (error) {
        console.error("[deleteCapability] Error:", error);
        return false;
    }
}

// Parse capabilities text into an array
export function parseCapabilitiesText(capabilitiesText: string): string[] {
    return capabilitiesText
        ? capabilitiesText
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
        : [];
}

// Create or get capabilities from a text string
export async function createOrGetCapabilities(
    capabilitiesText: string,
): Promise<Record<string, boolean>> {
    console.log(`[createOrGetCapabilities] Processing: ${capabilitiesText}`);
    const capabilityNames = parseCapabilitiesText(capabilitiesText);
    const capabilityMap: Record<string, boolean> = {};

    for (const name of capabilityNames) {
        const cap = await createCapability(name);
        if (cap) {
            capabilityMap[cap.capability_id] = true;
            console.log(
                `[createOrGetCapabilities] Added: ${cap.capability_id}`,
            );
        }
    }

    console.log(
        `[createOrGetCapabilities] Processed ${Object.keys(capabilityMap).length} capabilities`,
    );
    return capabilityMap;
}
