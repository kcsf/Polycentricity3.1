# Polycentricity3 User Role Integration Plan

## Current State Analysis
1. The application uses Gun.js for decentralized data storage
2. User authentication already exists with basic roles (Guest, Member, Admin)
3. Current registration immediately assigns users as "Guest" or "Admin" (if bjorn@endogon.com)
4. Login and register pages are client-side only without server endpoints
5. No email verification or Turnstile integration exists yet

## Proposed Implementation Plan

### Files to Create or Modify

#### 1. New Files
- `src/routes/verify/+page.svelte` - Verification page for email links
- `src/routes/api/sendgrid/+server.ts` - SvelteKit endpoint for SendGrid emails
- `src/routes/api/turnstile/+server.ts` - SvelteKit endpoint for Turnstile verification 
- `src/lib/components/auth/RoleGuard.svelte` - Component to restrict access based on user role
- `src/lib/components/auth/TurnstileWidget.svelte` - Reusable Turnstile widget component

#### 2. Files to Modify
- `src/routes/register/+page.svelte` - Add Turnstile and modify registration flow
- `src/routes/login/+page.svelte` - Add Turnstile integration
- `src/lib/services/authService.ts` - Add new methods for verification
- `src/app.d.ts` - Add type definitions for any new interfaces

### Implementation Details

#### 1. Turnstile Integration (`src/lib/components/auth/TurnstileWidget.svelte`)
```svelte
<script lang="ts">
  $props({ sitekey: String });
  
  let turnstileRef;
  let token = $state('');
  let errorMessage = $state('');
  
  const dispatch = createEventDispatcher<{
    verified: string;
    error: string;
  }>();
  
  $effect(() => {
    if (typeof window !== 'undefined') {
      // Load Turnstile script if not already loaded
      if (!document.getElementById('cloudflare-turnstile-script')) {
        const script = document.createElement('script');
        script.id = 'cloudflare-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }
  });
  
  $effect(() => {
    if (token) {
      dispatch('verified', token);
    }
  });
  
  function onVerify(response: string) {
    token = response;
  }
  
  function onError(error: Error) {
    errorMessage = error.message;
    dispatch('error', error.message);
  }
</script>

<div class="cf-turnstile relative my-4" data-sitekey={sitekey} data-callback="onVerify" data-error-callback="onError" bind:this={turnstileRef}></div>

{#if errorMessage}
<p class="text-error-400-500 text-sm">{errorMessage}</p>
{/if}
```

#### 2. SendGrid Email API (`src/routes/api/sendgrid/+server.ts`)
```typescript
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
  try {
    const SENDGRID_API_KEY = '<SENDGRID_API_KEY>';
    const { to, subject, text, html } = await request.json();
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SENDGRID_API_KEY}`
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'polycentricity@endogon.com', name: 'Polycentricity' },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html }
        ]
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }
    
    return json({ success: true });
  } catch (error) {
    console.error('Email sending error:', error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}
```

#### 3. Turnstile Verification Endpoint (`src/routes/api/turnstile/+server.ts`)
```typescript
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
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
}
```

#### 4. Auth Service Enhancements (`src/lib/services/authService.ts`)
```typescript
// Add these new functions to authService.ts

/**
 * Generate a magic key for email verification
 * @returns Random string for verification
 */
function generateMagicKey(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Register a new user with email verification
 * @param name User's name
 * @param email User's email
 * @param password User's password
 * @returns Promise with registered user or null
 */
export async function registerUserWithVerification(
  name: string,
  email: string,
  password: string
): Promise<User | null> {
  try {
    console.log(`Starting verified registration for: ${email}`);
    
    const gun = getGun();
    const user = getUser();
    if (!gun || !user) throw new Error("Gun or user not initialized");
    
    // Check if user already exists
    const userExists = await userExistsByEmail(email);
    if (userExists) {
      throw new Error("This email is already registered");
    }
    
    return new Promise<User>((resolve, reject) => {
      user.create(email, password, async (ack: any) => {
        if (ack.err) {
          console.error("User creation error:", ack.err);
          setError(String(ack.err));
          return reject(ack.err);
        }
        
        user.auth(email, password, (authAck: any) => {
          if (authAck.err) {
            console.error("Authentication error:", authAck.err);
            setError(String(authAck.err));
            return reject(authAck.err);
          }
          
          const user_id = user._.sea?.pub;
          if (!user_id) {
            const err = "No public key found after authentication";
            console.error(err);
            setError(err);
            return reject(err);
          }
          
          const magic_key = generateMagicKey();
          
          const userData: User = {
            user_id,
            name,
            email,
            pub: user_id,
            role: "Guest",
            magic_key,
            created_at: Date.now(),
          };
          
          console.log(`Saving user profile with verification for: ${user_id}`);
          
          // Use putSigned for user data
          user.get("profile").get('magic_key').putSigned(magic_key, (putAck: any) => {
            if (putAck.err) {
              console.error("Error saving user magic_key:", putAck.err);
              setError(String(putAck.err));
            }
          });
          
          // 1) Private SEA-encrypted profile
          user.get("profile").put(userData, (putAck: any) => {
            if (putAck.err) {
              console.error("Error saving user profile:", putAck.err);
              setError(String(putAck.err));
            }
            
            // 2) Mirror to public users/{user_id} for lookups
            gun.get("users").get(user_id).put(userData);
            
            // 3) Send verification email
            sendVerificationEmail(email, user_id, magic_key).catch(error => {
              console.error("Error sending verification email:", error);
            });
          });
          
          // Update Svelte store
          userStore.update((state) => ({
            ...state,
            user: userData,
            isAuthenticated: true,
            isLoading: false,
            lastError: null,
          }));
          
          console.log("User registration complete (verification pending)");
          resolve(userData);
        });
      });
    });
  } catch (error: any) {
    const msg = String(error);
    console.error("Registration error:", msg);
    setError(msg);
    return null;
  }
}

/**
 * Send verification email via SendGrid
 * @param email User's email
 * @param userId User's ID
 * @param magicKey Verification key
 */
async function sendVerificationEmail(
  email: string,
  userId: string,
  magicKey: string
): Promise<void> {
  try {
    const verificationUrl = `http://localhost:5000/verify?userId=${userId}&magicKey=${magicKey}`;
    
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
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

/**
 * Verify a user's email using magic key
 * @param userId User's ID
 * @param magicKey Verification key
 * @returns Promise with success status
 */
export async function verifyUser(
  userId: string,
  magicKey: string
): Promise<boolean> {
  try {
    console.log(`Verifying user: ${userId} with magic key`);
    
    const gun = getGun();
    const user = getUser();
    if (!gun || !user) throw new Error("Gun or user not initialized");
    
    return new Promise<boolean>((resolve, reject) => {
      // Get the user's data
      gun.get('users').get(userId).once((userData: any) => {
        if (!userData) {
          console.error("User not found");
          return resolve(false);
        }
        
        // Check if magic key matches
        if (userData.magic_key !== magicKey) {
          console.error("Invalid magic key");
          return resolve(false);
        }
        
        // Update user role to Member
        user.get("profile").get('role').putSigned("Member", (putAck: any) => {
          if (putAck.err) {
            console.error("Error updating user role:", putAck.err);
            return resolve(false);
          }
          
          // Clear magic key
          user.get("profile").get('magic_key').putSigned(null, (clearAck: any) => {
            if (clearAck.err) {
              console.error("Error clearing magic key:", clearAck.err);
            }
          });
          
          // Update public user data
          const updatedUserData = {
            ...userData,
            role: "Member",
            magic_key: null
          };
          
          gun.get("users").get(userId).put(updatedUserData);
          
          // Update store if this is the current user
          if ($userStore.user?.user_id === userId) {
            userStore.update((state) => ({
              ...state,
              user: {
                ...state.user!,
                role: "Member",
                magic_key: null
              }
            }));
          }
          
          console.log("User verified successfully");
          resolve(true);
        });
      });
    });
  } catch (error) {
    console.error("Verification error:", error);
    return false;
  }
}
```

#### 5. Verification Page (`src/routes/verify/+page.svelte`)
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { verifyUser } from '$lib/services/authService';
  
  let isVerifying = $state(true);
  let isSuccess = $state(false);
  let isError = $state(false);
  let errorMessage = $state('');
  
  onMount(async () => {
    const url = new URL(window.location.href);
    const userId = url.searchParams.get('userId');
    const magicKey = url.searchParams.get('magicKey');
    
    if (!userId || !magicKey) {
      isVerifying = false;
      isError = true;
      errorMessage = 'Invalid verification link. Missing required parameters.';
      return;
    }
    
    try {
      const success = await verifyUser(userId, magicKey);
      
      isVerifying = false;
      isSuccess = success;
      isError = !success;
      
      if (!success) {
        errorMessage = 'Verification failed. The link may be expired or invalid.';
      } else {
        // Redirect to login after short delay
        setTimeout(() => {
          goto('/login');
        }, 3000);
      }
    } catch (error) {
      isVerifying = false;
      isError = true;
      errorMessage = error.message || 'An unexpected error occurred during verification.';
    }
  });
</script>

<div class="container h-full mx-auto flex justify-center items-center py-8">
  <div class="card p-4 w-full max-w-md">
    <header class="card-header text-center">
      <h1 class="h2">Email Verification</h1>
    </header>
    
    <section class="p-4 text-center">
      {#if isVerifying}
        <div class="flex flex-col items-center justify-center gap-4">
          <div class="spinner-border h-10 w-10" role="status" aria-hidden="true"></div>
          <p>Verifying your email address...</p>
        </div>
      {:else if isSuccess}
        <div class="flex flex-col items-center justify-center gap-4">
          <div class="bg-success-100-700 text-success-500-300 rounded-full p-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <p class="text-lg font-semibold">Your email has been verified!</p>
          <p>Your account has been upgraded to Member status.</p>
          <p class="text-sm">Redirecting to login page...</p>
        </div>
      {:else if isError}
        <div class="flex flex-col items-center justify-center gap-4">
          <div class="bg-error-100-700 text-error-500-300 rounded-full p-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <p class="text-lg font-semibold">Verification Failed</p>
          <p>{errorMessage}</p>
          <a href="/register" class="btn variant-filled-primary">Register Again</a>
        </div>
      {/if}
    </section>
  </div>
</div>
```

#### 6. Role Guard Component (`src/lib/components/auth/RoleGuard.svelte`)
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';
  
  $props({
    roles: Array<'Guest' | 'Member' | 'Admin'>,
    redirectTo: String
  });
  
  let isAuthorized = $state(false);
  let isChecking = $state(true);
  
  onMount(() => {
    checkAuthorization();
  });
  
  $effect(() => {
    if ($userStore.isAuthenticated !== undefined) {
      checkAuthorization();
    }
  });
  
  function checkAuthorization() {
    isChecking = true;
    
    // Not authenticated at all
    if (!$userStore.isAuthenticated || !$userStore.user) {
      isChecking = false;
      isAuthorized = false;
      goto(redirectTo);
      return;
    }
    
    // Check if user role is in allowed roles
    if (roles.includes($userStore.user.role as any)) {
      isChecking = false;
      isAuthorized = true;
    } else {
      isChecking = false;
      isAuthorized = false;
      goto(redirectTo);
    }
  }
</script>

{#if isAuthorized && !isChecking}
  <slot />
{/if}

{#if isChecking}
  <div class="flex justify-center items-center min-h-screen">
    <div class="spinner-border h-10 w-10" role="status" aria-hidden="true"></div>
  </div>
{/if}
```

#### 7. Modified Register Page (`src/routes/register/+page.svelte`)
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { registerUserWithVerification } from '$lib/services/authService';
  import { userStore } from '$lib/stores/userStore';
  import TurnstileWidget from '$lib/components/auth/TurnstileWidget.svelte';
  
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let isRegistering = $state(false);
  let error = $state('');
  let turnstileToken = $state('');
  let isRegistrationComplete = $state(false);
  
  const TURNSTILE_SITE_KEY = '<CLOUDFLARE_TURNSTILE_SITEKEY>';
  
  onMount(() => {
    if ($userStore.user) {
      console.log('User already authenticated, redirecting to dashboard');
      goto('/dashboard');
    }
  });
  
  const validationError = $derived(
    name && email && password
      ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? 'Please enter a valid email address'
        : password.length < 6
        ? 'Password must be at least 6 characters long'
        : ''
      : ''
  );
  
  $effect(() => {
    if (validationError) {
      error = validationError;
    }
  });
  
  async function verifyTurnstile(token: string) {
    try {
      const response = await fetch('/api/turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      
      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('Turnstile verification error:', err);
      return false;
    }
  }
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    
    if (!name.trim() || !email.trim() || !password) {
      error = 'All fields are required';
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      error = 'Please enter a valid email address';
      return;
    }
    
    if (password.length < 6) {
      error = 'Password must be at least 6 characters long';
      return;
    }
    
    if (!turnstileToken) {
      error = 'Please complete the Turnstile verification';
      return;
    }
    
    isRegistering = true;
    
    try {
      // First verify Turnstile token
      const isTurnstileValid = await verifyTurnstile(turnstileToken);
      
      if (!isTurnstileValid) {
        error = 'Turnstile verification failed. Please try again.';
        isRegistering = false;
        return;
      }
      
      // If we get here, continue with registration
      console.log(`Proceeding with registration for: ${email}`);
      const user = await registerUserWithVerification(name, email, password);
      
      if (user) {
        console.log(`Successfully registered user: ${user.user_id}`);
        isRegistrationComplete = true;
      } else {
        error = 'Registration failed. Please try again.';
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      error =
        typeof err === 'string'
          ? err
          : err.message || 'An error occurred during registration';
      
      // Check for the common "User already created" error
      if (err?.includes && err.includes('User already created')) {
        error = 'This email is already registered in the database. Please try using a different email.';
      }
    } finally {
      isRegistering = false;
    }
  }
  
  function handleTurnstileVerified(event: CustomEvent<string>) {
    turnstileToken = event.detail;
  }
  
  function handleTurnstileError(event: CustomEvent<string>) {
    error = `Turnstile error: ${event.detail}`;
  }
</script>

<div class="container h-full mx-auto flex justify-center items-center py-8">
  <div class="card p-4 w-full max-w-md">
    <header class="card-header text-center">
      <h1 class="h2">Create Account</h1>
      <p class="opacity-70">Join Polycentricity3 and start building eco-villages</p>
    </header>
    
    <section class="p-4">
      {#if isRegistrationComplete}
        <div class="alert variant-ghost-success">
          <div class="alert-message">
            <h3 class="h4">Registration Successful!</h3>
            <p>A verification email has been sent to {email}. Please check your inbox and click the verification link to activate your account.</p>
          </div>
        </div>
        
        <div class="mt-4 text-center">
          <a href="/login" class="btn variant-filled-primary">Proceed to Login</a>
        </div>
      {:else}
        {#if error}
          <div class="alert variant-ghost-warning">
            <div class="alert-message">
              <p class="text-sm">{error}</p>
            </div>
          </div>
        {/if}
        
        <form onsubmit={handleSubmit} class="space-y-4">
          <label class="label">
            <span>Name</span>
            <input
              type="text"
              class="input"
              value={name}
              oninput={(e) => (name = e.currentTarget.value)}
              placeholder="Enter your name"
              required
            />
          </label>
          
          <label class="label">
            <span>Email</span>
            <input
              type="email"
              class="input"
              value={email}
              oninput={(e) => (email = e.currentTarget.value)}
              placeholder="Enter your email"
              required
            />
          </label>
          
          <label class="label">
            <span>Password</span>
            <input
              type="password"
              class="input"
              value={password}
              oninput={(e) => (password = e.currentTarget.value)}
              placeholder="Create a password"
              required
            />
          </label>
          
          <TurnstileWidget 
            sitekey={TURNSTILE_SITE_KEY} 
            on:verified={handleTurnstileVerified}
            on:error={handleTurnstileError}
          />
          
          <button
            type="submit"
            class="btn variant-filled-primary w-full"
            disabled={isRegistering}
          >
            {isRegistering ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        
        <div class="mt-4 text-center">
          <p>Already have an account? <a href="/login" class="anchor">Login</a></p>
        </div>
      {/if}
    </section>
  </div>
</div>
```

#### 8. Modified Login Page (`src/routes/login/+page.svelte`)
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { loginUser, getGun, getUser } from '$lib/services/authService';
  import { userStore } from '$lib/stores/userStore';
  import TurnstileWidget from '$lib/components/auth/TurnstileWidget.svelte';
  
  let email = $state('bjorn@endogon.com');
  let password = $state('admin123');
  let isLoggingIn = $state(false);
  let error = $state('');
  let rememberMe = $state(true);
  let turnstileToken = $state('');
  
  const TURNSTILE_SITE_KEY = '<CLOUDFLARE_TURNSTILE_SITEKEY>';
  
  onMount(() => {
    if ($userStore.user) {
      goto('/dashboard');
    }
    
    const storedEmail = localStorage.getItem('polycentricity_email');
    if (storedEmail) {
      email = storedEmail;
    }
  });
  
  async function verifyTurnstile(token: string) {
    try {
      const response = await fetch('/api/turnstile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      
      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('Turnstile verification error:', err);
      return false;
    }
  }
  
  function handleTurnstileVerified(event: CustomEvent<string>) {
    turnstileToken = event.detail;
  }
  
  function handleTurnstileError(event: CustomEvent<string>) {
    error = `Turnstile error: ${event.detail}`;
  }
  
  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    
    if (!email.trim() || !password) {
      error = 'Email and password are required';
      return;
    }
    
    if (!turnstileToken) {
      error = 'Please complete the Turnstile verification';
      return;
    }
    
    isLoggingIn = true;
    try {
      // First verify Turnstile token
      const isTurnstileValid = await verifyTurnstile(turnstileToken);
      
      if (!isTurnstileValid) {
        error = 'Turnstile verification failed. Please try again.';
        isLoggingIn = false;
        return;
      }
      
      const user = await loginUser(email, password);
      if (user) {
        console.log(`Login successful: ${user.user_id}`);
        
        // Update last_login timestamp
        const gun = getGun();
        const gunUser = getUser();
        
        if (gun && gunUser) {
          const timestamp = Date.now();
          gunUser.get("profile").get('last_login').putSigned(timestamp, (ack) => {
            if (ack.err) console.error("Error updating last_login:", ack.err);
          });
          
          // Update in public users as well
          gun.get("users").get(user.user_id).get('last_login').put(timestamp);
        }
        
        if (rememberMe) {
          localStorage.setItem('polycentricity_email', email);
        } else {
          localStorage.removeItem('polycentricity_email');
        }
        
        try {
          await goto('/dashboard');
        } catch (navError) {
          console.error('Navigation error:', navError);
          window.location.href = '/dashboard';
        }
      } else {
        error = 'Invalid email or password';
      }
    } catch (err: any) {
      console.error('Login error:', err);
      error = err.message || 'An error occurred during login';
    } finally {
      isLoggingIn = false;
    }
  }
</script>

<div class="container h-full mx-auto flex justify-center items-center py-8">
  <div class="card p-4 w-full max-w-md">
    <header class="card-header text-center">
      <h1 class="h2">Welcome Back</h1>
      <p class="opacity-70">Login to continue building your eco-village</p>
    </header>
    
    <section class="p-4">
      {#if error}
        <div class="alert variant-ghost-warning">
          <div class="alert-message">
            <p class="text-sm">{error}</p>
          </div>
        </div>
      {/if}
      
      <form onsubmit={handleSubmit} class="space-y-4" id="login-form" name="login-form">
        <label class="label" for="email">
          <span>Email</span>
          <input
            id="email"
            name="email"
            type="email"
            class="input"
            value={email}
            oninput={(e) => (email = e.currentTarget.value)}
            placeholder="Enter your email"
            autocomplete="email"
            required
          />
        </label>
        
        <label class="label" for="password">
          <span>Password</span>
          <input
            id="password"
            name="password"
            type="password"
            class="input"
            value={password}
            oninput={(e) => (password = e.currentTarget.value)}
            placeholder="Enter your password"
            autocomplete="current-password"
            required
          />
        </label>
        
        <TurnstileWidget 
          sitekey={TURNSTILE_SITE_KEY} 
          on:verified={handleTurnstileVerified}
          on:error={handleTurnstileError}
        />
        
        <label class="flex items-center space-x-2 mb-4">
          <input
            type="checkbox"
            checked={rememberMe}
            oninput={(e) => (rememberMe = e.currentTarget.checked)}
            class="checkbox"
          />
          <span class="text-sm">Remember my email</span>
        </label>
        
        <button
          type="submit"
          class="btn variant-filled-primary w-full"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? 'Logging in...' : 'Login'}
        </button>
      </form>
      
      <div class="mt-4 text-center">
        <p>Don't have an account? <a href="/register" class="anchor">Register</a></p>
      </div>
    </section>
  </div>
</div>
```

### Practical Usage Examples

#### Using RoleGuard in Routes
```svelte
<!-- src/routes/admin/+layout.svelte -->
<script lang="ts">
  import RoleGuard from '$lib/components/auth/RoleGuard.svelte';
</script>

<RoleGuard roles={['Admin']} redirectTo="/login">
  <slot />
</RoleGuard>
```

```svelte
<!-- src/routes/games/+layout.svelte -->
<script lang="ts">
  import RoleGuard from '$lib/components/auth/RoleGuard.svelte';
</script>

<RoleGuard roles={['Member', 'Admin']} redirectTo="/login">
  <slot />
</RoleGuard>
```

#### Working with the APIs
Example of making a request from client to server for email verification:

```javascript
// Example of calling the SendGrid endpoint
async function sendWelcomeEmail(email, username) {
  try {
    const response = await fetch('/api/sendgrid', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: email,
        subject: 'Welcome to Polycentricity!',
        text: `Hello ${username}, welcome to our community!`,
        html: `<h1>Welcome, ${username}!</h1><p>We're excited to have you with us.</p>`
      })
    });
    
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
}
```

### Proposed Additional Functions for authService.ts

These functions would need to be added to accommodate the new role-based system:

```typescript
/**
 * Check if user has required role
 * @param roles Allowed roles
 * @returns boolean indicating if user has required role
 */
export function hasRole(roles: Array<'Guest' | 'Member' | 'Admin'>): boolean {
  const { user } = get(userStore);
  if (!user) return false;
  return roles.includes(user.role as any);
}

/**
 * Promote a user to a new role
 * @param userId The user ID to promote
 * @param newRole The new role to assign
 * @returns Promise with success status
 */
export async function updateUserRole(
  userId: string, 
  newRole: 'Guest' | 'Member' | 'Admin'
): Promise<boolean> {
  try {
    const gun = getGun();
    const user = getUser();
    
    if (!gun || !user) throw new Error("Gun or user not initialized");
    if (!['Guest', 'Member', 'Admin'].includes(newRole)) {
      throw new Error("Invalid role specified");
    }
    
    // Must be admin to change roles (except for self-verification)
    const currentUser = get(userStore).user;
    if (currentUser?.role !== 'Admin' && currentUser?.user_id !== userId) {
      throw new Error("Not authorized to update user roles");
    }
    
    return new Promise<boolean>((resolve) => {
      // Get the user's current data
      gun.get('users').get(userId).once((userData: any) => {
        if (!userData) {
          console.error("User not found");
          return resolve(false);
        }
        
        // Update role with putSigned if it's the current user
        if (currentUser?.user_id === userId) {
          user.get("profile").get('role').putSigned(newRole, (putAck: any) => {
            if (putAck.err) {
              console.error("Error updating user role:", putAck.err);
              return resolve(false);
            }
          });
        }
        
        // Update in the public users node
        const updatedUserData = {
          ...userData,
          role: newRole
        };
        
        gun.get("users").get(userId).put(updatedUserData);
        
        // Update store if this is the current user
        if (currentUser?.user_id === userId) {
          userStore.update((state) => ({
            ...state,
            user: {
              ...state.user!,
              role: newRole
            }
          }));
        }
        
        console.log(`User ${userId} role updated to ${newRole}`);
        resolve(true);
      });
    });
  } catch (error) {
    console.error("Role update error:", error);
    return false;
  }
}
```

## Implementation Timeline

1. Create basic components (TurnstileWidget, RoleGuard)
2. Add server endpoints for Turnstile and SendGrid
3. Update authService.ts with new verification functions
4. Implement verification page
5. Modify registration and login forms
6. Test all components with appropriate role restrictions
7. Deploy and monitor for any issues

## API Keys Required

Before implementation, the following API keys need to be provided:
- `<CLOUDFLARE_TURNSTILE_SITEKEY>` - Public key for Turnstile widget
- `<CLOUDFLARE_TURNSTILE_SECRET>` - Secret key for Turnstile verification
- `<SENDGRID_API_KEY>` - API key for SendGrid email service