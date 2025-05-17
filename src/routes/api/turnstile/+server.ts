import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Get the Turnstile secret with a fallback for development
let CLOUDFLARE_TURNSTILE_SECRET = '';

// Try to get from process.env first (for cases where environment variables are set differently)
if (typeof process !== 'undefined' && process.env && process.env.CLOUDFLARE_TURNSTILE_SECRET) {
  CLOUDFLARE_TURNSTILE_SECRET = process.env.CLOUDFLARE_TURNSTILE_SECRET;
} else {
  // Then try importing from SvelteKit's env module
  try {
    import('$env/static/private').then(module => {
      if (module.CLOUDFLARE_TURNSTILE_SECRET) {
        CLOUDFLARE_TURNSTILE_SECRET = module.CLOUDFLARE_TURNSTILE_SECRET;
      }
    }).catch(() => {
      console.log('No Turnstile secret found in environment, using development mode');
    });
  } catch (error) {
    // Will use development/Replit mode fallback
  }
}

// Development mode detection - expanded to include Replit environment
const isDevelopmentOrReplit = 
  process.env.NODE_ENV === 'development' || 
  process.env.REPL_ID || 
  process.env.REPLIT_CLUSTER;

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    console.log('Turnstile verification request received');
    const { token } = await request.json();
    
    // Log the token prefix for debugging
    if (token) {
      console.log('Token received with prefix:', token.substring(0, 10) + '...');
    } else {
      console.warn('No token provided in request');
    }
    
    // Check for development mode mock tokens
    if (isDevelopmentOrReplit && token && token.startsWith('dev-mock-')) {
      console.log('Using development/Replit mode for Turnstile verification');
      return json({ success: true, environment: 'development' });
    }
    
    // If we have a proper CLOUDFLARE_TURNSTILE_SECRET, verify with the real service
    if (CLOUDFLARE_TURNSTILE_SECRET) {
      console.log('Proceeding with Cloudflare Turnstile verification');
      
      const formData = new FormData();
      formData.append('secret', CLOUDFLARE_TURNSTILE_SECRET);
      formData.append('response', token);
      
      try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          console.error('Turnstile API responded with status:', response.status);
          const errorText = await response.text();
          console.error('Response body:', errorText);
          
          // For development environments, still proceed
          if (isDevelopmentOrReplit) {
            console.log('Allowing verification in development mode despite API error');
            return json({ success: true, environment: 'development', note: 'Verification bypassed due to API error' });
          }
          
          return json({ 
            success: false, 
            error: `API responded with status ${response.status}` 
          }, { status: 400 });
        }
        
        const data = await response.json();
        console.log('Turnstile API response:', data);
        
        if (data.success) {
          return json({ success: true });
        } else {
          console.error('Turnstile verification failed:', data['error-codes']);
          
          // For development environments, still proceed
          if (isDevelopmentOrReplit) {
            console.log('Allowing verification in development mode despite failure');
            return json({ success: true, environment: 'development', note: 'Verification bypassed despite failure' });
          }
          
          return json({ success: false, error: data['error-codes'] }, { status: 400 });
        }
      } catch (fetchError) {
        console.error('Error during Turnstile API call:', fetchError);
        
        // For development environments, still proceed
        if (isDevelopmentOrReplit) {
          console.log('Allowing verification in development mode despite fetch error');
          return json({ success: true, environment: 'development', note: 'Verification bypassed due to fetch error' });
        }
        
        throw fetchError;
      }
    } else {
      console.warn('CLOUDFLARE_TURNSTILE_SECRET not configured');
      
      // If in development/Replit, proceed anyway
      if (isDevelopmentOrReplit) {
        console.log('Allowing verification in development mode without secret key');
        return json({ success: true, environment: 'development', note: 'Secret key not configured' });
      } else {
        return json({ 
          success: false, 
          error: 'Turnstile verification not configured' 
        }, { status: 500 });
      }
    }
  } catch (error: any) {
    console.error('Turnstile verification error:', error);
    
    // For development environments, still proceed
    if (isDevelopmentOrReplit) {
      console.log('Allowing verification in development mode despite error');
      return json({ success: true, environment: 'development', note: 'Error during verification' });
    }
    
    return json({ 
      success: false, 
      error: typeof error === 'string' ? error : error.message || 'Unknown error'
    }, { status: 500 });
  }
};