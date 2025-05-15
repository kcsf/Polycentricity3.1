import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sgMail from '@sendgrid/mail';
import { SENDGRID_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
  try {
    sgMail.setApiKey(SENDGRID_API_KEY);
    
    const { to, subject, text, html } = await request.json();
    
    const msg = {
      to,
      from: 'polycentricity@endogon.com',
      subject,
      text,
      html
    };
    
    await sgMail.send(msg);
    
    return json({ success: true });
  } catch (error: any) {
    console.error('Email sending error:', error);
    return json({ 
      success: false, 
      error: typeof error === 'string' ? error : error.message || 'Unknown error'
    }, { status: 500 });
  }
};