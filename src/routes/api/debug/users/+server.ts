import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGun, get, nodes } from '$lib/services/gunService';

export const GET: RequestHandler = async ({ url }) => {
  const email = url.searchParams.get('email');
  
  if (!email) {
    return json({ error: 'Email parameter is required' }, { status: 400 });
  }
  
  try {
    const results: any = {};
    const gun = getGun();
    
    if (!gun) {
      return json({ error: 'Gun not initialized' }, { status: 500 });
    }
    
    // Check if user exists in Gun's authentication system
    const aliasPromise = new Promise<any>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 3000);
      gun.get(`~@${email}`).once((alias) => {
        clearTimeout(timeout);
        results.alias = alias || null;
        resolve(alias);
      });
    });
    
    const alias = await aliasPromise;
    
    if (alias && typeof alias === 'string') {
      // Extract the public key from the alias
      const pubKey = alias.startsWith('~') ? alias.substring(1) : alias;
      results.pubKey = pubKey;
      
      // Look up the user in our users collection
      try {
        const userPath = `${nodes.users}/${pubKey}`;
        results.userPath = userPath;
        
        const userDataPromise = new Promise<any>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 3000);
          gun.get(userPath).once((userData) => {
            clearTimeout(timeout);
            resolve(userData);
          });
        });
        
        const userData = await userDataPromise;
        results.userData = userData || null;
      } catch (err) {
        results.userLookupError = err instanceof Error ? err.message : String(err);
      }
    }
    
    return json({
      email,
      results
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      email 
    }, { status: 500 });
  }
};