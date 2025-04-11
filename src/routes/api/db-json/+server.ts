import { json } from '@sveltejs/kit';
import { getGun, nodes } from '$lib/services/gunService';

export async function GET() {
  const gun = getGun();
  
  if (!gun) {
    return json({ error: 'Gun not initialized' }, { status: 500 });
  }
  
  try {
    // Collect all data from the database
    const dbData: Record<string, any> = {};
    
    // Function to fetch data from a Gun node
    const fetchNodeData = (nodeName: string): Promise<Record<string, any>> => {
      return new Promise((resolve) => {
        const data: Record<string, any> = {};
        let hasData = false;
        
        // Set a timeout in case Gun doesn't return
        const timeout = setTimeout(() => {
          console.log(`Timeout fetching ${nodeName} data`);
          resolve(data);
        }, 1000);
        
        gun.get(nodeName).map().once((value: any, key: string) => {
          if (value !== null && value !== undefined) {
            data[key] = value;
            hasData = true;
          }
          
          // If this is the first data received, clear the timeout
          if (hasData && timeout) {
            clearTimeout(timeout);
          }
        });
        
        // Return after a brief delay anyway to ensure we get some data
        setTimeout(() => {
          resolve(data);
        }, 500);
      });
    };
    
    // Fetch data for all important nodes
    dbData.values = await fetchNodeData(nodes.values);
    dbData.capabilities = await fetchNodeData(nodes.capabilities);
    dbData.cards = await fetchNodeData(nodes.cards);
    dbData.decks = await fetchNodeData(nodes.decks);
    
    return json(dbData);
  } catch (error) {
    console.error('Error fetching database data:', error);
    return json({ error: 'Failed to fetch database data' }, { status: 500 });
  }
}