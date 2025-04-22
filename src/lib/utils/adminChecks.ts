/**
 * Admin Utility Functions
 * Contains utilities for checking admin status and admin-related functionality
 */

/**
 * List of email addresses that should have admin privileges
 * Add your own email address here to gain admin access
 */
export const ADMIN_EMAILS = [
  'bjorn@endogon.com',
  'admin@example.com',
  'admin@polycentricity.org'
];

/**
 * Check if an email address should have admin privileges
 * @param email Email address to check
 * @returns Boolean indicating if the email should have admin privileges
 */
export function isAdminEmail(email: string): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some(adminEmail => 
    email.toLowerCase() === adminEmail.toLowerCase()
  );
}

/**
 * Check if a user object has admin privileges
 * @param user User object with role property
 * @returns Boolean indicating if the user has admin privileges
 */
export function isAdminUser(user: { role?: string; email?: string } | null): boolean {
  if (!user) return false;
  
  // Check by role first
  if (user.role === 'Admin') return true;
  
  // Fall back to email check if role isn't admin
  return user.email ? isAdminEmail(user.email) : false;
}