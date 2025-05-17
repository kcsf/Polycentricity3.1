import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import sgMail from '@sendgrid/mail';

// Get SendGrid API key with fallback mechanism
let SENDGRID_API_KEY = '';

// Try to get from process.env first (for Node.js environments)
if (typeof process !== 'undefined' && process.env && process.env.SENDGRID_API_KEY) {
  SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
} else {
  // Then try importing from SvelteKit's env module
  try {
    import('$env/static/private').then(module => {
      if (module.SENDGRID_API_KEY) {
        SENDGRID_API_KEY = module.SENDGRID_API_KEY;
        // Initialize SendGrid once we have the key
        if (SENDGRID_API_KEY) {
          sgMail.setApiKey(SENDGRID_API_KEY);
        }
      }
    }).catch(() => {
      console.log('No SendGrid API key found in environment, emails will be logged only');
    });
  } catch (error) {
    console.log('Error loading SendGrid API key:', error);
  }
}

// Whether we're in development mode
const isDevelopment = 
  (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') ||
  (typeof window !== 'undefined' && window.location && 
    (window.location.hostname === 'localhost' || window.location.hostname.includes('replit')));

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { to, subject, text, html } = await request.json();
    
    const msg = {
      to,
      from: 'polycentricity@endogon.com', // Use your verified sender email
      subject,
      text,
      html
    };
    
    // In development without API key, log the email instead of sending
    if (isDevelopment && !SENDGRID_API_KEY) {
      console.log('Development mode - Would send email:', {
        to: msg.to,
        subject: msg.subject,
        text: msg.text?.substring(0, 100) + '...',
        html: msg.html?.substring(0, 100) + '...'
      });
      return json({ success: true, mode: 'development' });
    }
    
    // If we have an API key, initialize and send
    if (SENDGRID_API_KEY) {
      sgMail.setApiKey(SENDGRID_API_KEY);
      await sgMail.send(msg);
      return json({ success: true });
    } else {
      console.error('SendGrid API key not configured');
      return json({ 
        success: false, 
        error: 'Email service not configured'
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Email sending error:', error);
    return json({ 
      success: false, 
      error: typeof error === 'string' ? error : error.message || 'Unknown error'
    }, { status: 500 });
  }
};