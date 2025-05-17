/**
 * Email service for sending verification and notification emails
 */
export async function sendVerificationEmail(
  email: string,
  userId: string,
  magicKey: string
): Promise<boolean> {
  try {
    // Get the base URL by checking different environments
    let baseUrl = '';
    
    // First try window.location if we're in the browser
    if (typeof window !== 'undefined' && window.location) {
      const { protocol, host } = window.location;
      baseUrl = `${protocol}//${host}`;
    } 
    // Try to detect Replit environment
    else if (typeof process !== 'undefined' && process.env && process.env.REPL_ID) {
      // Use Replit's domain structure
      baseUrl = `https://${process.env.REPL_ID}.id.repl.co`;
    } 
    // Fallback for local development
    else {
      baseUrl = 'http://localhost:5000';
    }
    
    const verificationUrl = `${baseUrl}/verify?userId=${encodeURIComponent(userId)}&magicKey=${encodeURIComponent(magicKey)}`;
    
    const response = await fetch('/api/sendgrid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: email,
        subject: 'Verify your Polycentricity account',
        text: `Please verify your email by clicking this link: ${verificationUrl}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Welcome to Polycentricity!</h2>
            <p>Please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4A56E2; color: white; text-decoration: none; border-radius: 4px;">
              Verify Email
            </a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
          </div>
        `
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send verification email');
    }
    
    console.log('Verification email sent successfully');
    return true;
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

/**
 * Send a welcome email to newly verified members
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  try {
    const response = await fetch('/api/sendgrid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: email,
        subject: 'Welcome to Polycentricity - Your Account is Active!',
        text: `Hello ${name}, your account has been verified and is now active. You can now access all member features.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2>Welcome to Polycentricity, ${name}!</h2>
            <p>Your account has been verified and is now active.</p>
            <p>You now have access to all member features including:</p>
            <ul>
              <li>Creating and joining games</li>
              <li>Participating in community discussions</li>
              <li>Building eco-villages and sustainable communities</li>
            </ul>
            <p>Get started by exploring the dashboard and joining a game.</p>
            <p><a href="${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'}/dashboard" style="color: #4A56E2;">Go to Dashboard</a></p>
          </div>
        `
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send welcome email');
    }
    
    console.log('Welcome email sent successfully');
    return true;
  } catch (error: any) {
    console.error('Error sending welcome email:', error);
    return false;
  }
}