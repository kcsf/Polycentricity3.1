import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CLOUDFLARE_TURNSTILE_SECRET } from '$env/static/private';

// Development mode detection
const isDevelopmentMode = process.env.NODE_ENV === 'development';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { token } = await request.json();
    
    // Check for development mode mock tokens
    if (isDevelopmentMode && token && token.startsWith('dev-mock-token-')) {
      console.log('Using development mode for Turnstile verification');
      return json({ success: true });
    }
    
    // Proceed with real verification for production
    const formData = new FormData();
    formData.append('secret', CLOUDFLARE_TURNSTILE_SECRET);
    formData.append('response', token);
    
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      return json({ success: true });
    } else {
      console.error('Turnstile verification failed:', data['error-codes']);
      return json({ success: false, error: data['error-codes'] }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Turnstile verification error:', error);
    return json({ 
      success: false, 
      error: typeof error === 'string' ? error : error.message || 'Unknown error'
    }, { status: 500 });
  }
};