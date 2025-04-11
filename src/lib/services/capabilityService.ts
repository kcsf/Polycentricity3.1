// Capability management service
import { getGun, nodes, generateId, put, get } from "./gunService";
import type { Capability } from "$lib/types";

// Create or get a capability
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

// Get all capabilities
export async function getAllCapabilities(): Promise<Capability[]> {
    console.log("[getAllCapabilities] Fetching all capabilities");
    const gun = getGun();
    if (!gun) return [];

    const caps: Capability[] = [];
    await new Promise<void>((resolve) => {
        gun.get(nodes.capabilities)
            .map()
            .once((data: Capability) => {
                if (data) caps.push(data);
            });
        setTimeout(resolve, 500);
    });
    console.log(`[getAllCapabilities] Found ${caps.length} capabilities`);
    return caps;
}
