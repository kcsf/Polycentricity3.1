import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CLOUDFLARE_TURNSTILE_SECRET } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { token } = await request.json();
    
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