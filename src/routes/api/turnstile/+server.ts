import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { token } = await request.json();
    const TURNSTILE_SECRET = '<CLOUDFLARE_TURNSTILE_SECRET>';
    
    const formData = new FormData();
    formData.append('secret', TURNSTILE_SECRET);
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
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};