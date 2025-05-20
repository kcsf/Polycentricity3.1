# Vercel Deployment Guide for Polycentricity3

This guide outlines the steps to deploy your SvelteKit application on Vercel.

## Prerequisites

- A GitHub, GitLab, or Bitbucket account with your code repository
- A Vercel account (sign up at [vercel.com](https://vercel.com))
- Your Cloudflare Turnstile and SendGrid API keys

## Deployment Steps

### 1. Push Your Code to a Git Repository

Make sure your latest code is pushed to your Git repository.

### 2. Connect to Vercel

1. Log in to your Vercel account
2. Click "Add New..." and select "Project"
3. Import your Git repository
4. Select the repository and click "Import"

### 3. Configure Project Settings

- **Framework Preset**: Select "SvelteKit"
- **Root Directory**: Leave as `.` (default)
- **Build Command**: Leave as default (uses package.json settings)
- **Output Directory**: Leave as default (automatically detected)

### 4. Environment Variables

Add the following environment variables:

| Name | Value |
|------|-------|
| `PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY` | Your Cloudflare Turnstile site key |
| `CLOUDFLARE_TURNSTILE_SECRET` | Your Cloudflare Turnstile secret key |
| `SENDGRID_API_KEY` | Your SendGrid API key |
| `NODE_ENV` | `production` |

### 5. Deploy

Click "Deploy" and wait for the build process to complete.

## Post-Deployment Steps

### Testing Your Deployment

Once deployed, test the following functionality:
- User registration with Turnstile verification
- Email verification links
- User login
- Access to protected routes
- Game creation and management
- Real-time data synchronization with Gun.js

### Custom Domain (Optional)

1. In your Vercel project dashboard, go to "Settings" → "Domains"
2. Add your custom domain and follow the DNS configuration instructions

### Monitoring and Logs

Monitor your application performance and logs in the Vercel dashboard.

## Troubleshooting

- If Gun.js connectivity issues occur, ensure websocket connections are allowed
- For email delivery problems, check SendGrid API credentials and logs
- For authorization issues, verify Cloudflare Turnstile configuration

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [SvelteKit Deployment Guide](https://kit.svelte.dev/docs/adapters)
- [Gun.js Deployment Considerations](https://gun.eco/docs/FAQ#how-do-i-deploy-gun-in-production)