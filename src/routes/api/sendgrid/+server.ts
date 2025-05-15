import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sgMail from '@sendgrid/mail';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const SENDGRID_API_KEY = '<SENDGRID_API_KEY>';
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
  } catch (error) {
    console.error('Email sending error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
};