<script lang="ts">
    import { onMount } from 'svelte';
    import { initializeSampleData, verifySampleData } from '$lib/services/sampleDataService';
    import { getGun, nodes } from '$lib/services/gunService';
    
    let result = "";
    let isWorking = false;
    let nodeType = "users";
    let gunData: any[] = [];
    
    // Define possible node types
    const nodeTypes = Object.keys(nodes);
    
    // Initialize sample data with our Gun.js compatible format
    async function seedDatabase() {
        isWorking = true;
        result = "Initializing sample data...";
        
        try {
            console.log("Starting sample data initialization");
            const seedResult = await initializeSampleData();
            result = `Seed result: ${JSON.stringify(seedResult)}`;
            console.log("Sample data initialization complete:", seedResult);
        } catch (error) {
            console.error("Error seeding database:", error);
            result = `Error: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            isWorking = false;
        }
    }
    
    // Verify sample data to check what was loaded
    async function verifyDatabase() {
        isWorking = true;
        result = "Verifying database...";
        
        try {
            console.log("Starting database verification");
            const verifyResult = await verifySampleData();
            result = `Verification result: ${JSON.stringify(verifyResult)}`;
            console.log("Database verification complete:", verifyResult);
        } catch (error) {
            console.error("Error verifying database:", error);
            result = `Error: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            isWorking = false;
        }
    }
    
    // Fetch data for a specific node type
    async function fetchData() {
        isWorking = true;
        gunData = [];
        result = `Fetching ${nodeType} data...`;
        
        const gun = getGun();
        if (!gun) {
            result = "Gun not initialized!";
            isWorking = false;
            return;
        }
        
        const nodePath = nodes[nodeType as keyof typeof nodes];
        if (!nodePath) {
            result = `Invalid node type: ${nodeType}`;
            isWorking = false;
            return;
        }
        
        try {
            console.log(`Fetching data for ${nodeType} at path ${nodePath}`);
            
            let items: any[] = [];
            
            // Set a timeout to prevent hanging
            const timeoutPromise = new Promise<void>((_, reject) => {
                setTimeout(() => reject(new Error("Fetch timeout")), 10000);
            });
            
            const fetchPromise = new Promise<void>((resolve) => {
                gun.get(nodePath).map().once((data: any, key: string) => {
                    if (key === '_' || !data) return;
                    items.push({ key, data });
                    console.log(`Found ${nodeType} with key ${key}:`, data);
                });
                
                // Give Gun.js time to fetch all the data
                setTimeout(() => resolve(), 2000);
            });
            
            // Race the fetch against the timeout
            await Promise.race([fetchPromise, timeoutPromise]);
            
            // Sort by key for consistent display
            gunData = items.sort((a, b) => a.key.localeCompare(b.key));
            result = `Found ${gunData.length} items of type ${nodeType}`;
            
        } catch (error) {
            console.error(`Error fetching ${nodeType} data:`, error);
            result = `Error: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            isWorking = false;
        }
    }
    
    // Prettier display of objects
    function formatValue(value: any): string {
        if (value === null || value === undefined) return "null";
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return Object.prototype.toString.call(value);
            }
        }
        return String(value);
    }
    
    // Initialize on mount
    onMount(() => {
        console.log("Test Database page mounted");
    });
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Gun.js Database Test Page</h1>
    
    <div class="flex space-x-4 mb-6">
        <button 
            class="btn variant-filled-primary" 
            on:click={seedDatabase} 
            disabled={isWorking}
        >
            {isWorking ? 'Working...' : 'Initialize Sample Data'}
        </button>
        
        <button 
            class="btn variant-filled-secondary" 
            on:click={verifyDatabase} 
            disabled={isWorking}
        >
            {isWorking ? 'Working...' : 'Verify Database'}
        </button>
    </div>
    
    <div class="mb-6">
        <div class="flex space-x-4 items-center">
            <label class="font-medium">
                Select Node Type:
                <select class="select" bind:value={nodeType} disabled={isWorking}>
                    {#each nodeTypes as type}
                        <option value={type}>{type}</option>
                    {/each}
                </select>
            </label>
            
            <button 
                class="btn variant-filled" 
                on:click={fetchData} 
                disabled={isWorking}
            >
                {isWorking ? 'Fetching...' : 'Fetch Data'}
            </button>
        </div>
    </div>
    
    {#if result}
        <div class="alert {result.includes('Error') ? 'variant-filled-error' : 'variant-filled-success'} mb-4">
            <p>{result}</p>
        </div>
    {/if}
    
    {#if gunData.length > 0}
        <div class="card p-4 mb-4">
            <h2 class="text-xl font-semibold mb-2">Data for {nodeType} ({gunData.length} items)</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each gunData as item}
                    <div class="card p-3 variant-soft">
                        <h3 class="font-mono text-sm font-semibold">{item.key}</h3>
                        <pre class="mt-2 text-xs overflow-auto max-h-60 bg-surface-100-800-token p-2 rounded">{formatValue(item.data)}</pre>
                    </div>
                {/each}
            </div>
        </div>
    {:else if !isWorking}
        <div class="alert variant-ghost-secondary">
            <p>No data found. Select a node type and click "Fetch Data".</p>
        </div>
    {/if}
    
    <div class="card p-4 variant-ghost mt-4">
        <h2 class="font-semibold mb-2">Gun.js Database Paths</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {#each nodeTypes as type}
                <div class="p-2 rounded bg-surface-100-800-token">
                    <span class="font-mono text-primary-500">{type}:</span> {nodes[type as keyof typeof nodes]}
                </div>
            {/each}
        </div>
    </div>
</div>