# UserRolePlan.md

## *COMPLETE - Keeping file below for posterity*

## Overview
Enhance user role management in Polycentricity3 with Cloudflare Turnstile for bot protection, SendGrid for email verification, and role-based access control. Update existing client-side `routes/login/+page.svelte` and `routes/register/+page.svelte`, add server-side logic, and create new components/routes. Align with Svelte 5.28.1 Runes, Gun.js 0.2020.1240, TypeScript, `src/lib/types/index.ts`, and `GunSchema.md`.

## Current State Analysis
- **Routes**: `routes/login/+page.svelte` and `routes/register/+page.svelte` are client-side, lacking server logic.
- **Auth**: `authService.ts` is updated to store users at `users/<user_id>`, use `gunService.ts`, support `magic_key` and `expires_at`, and handle verification.
- **Store**: `userStore.ts` uses `UserSession` type, supports `$userStore`.
- **Game Service**: `gameService.ts` includes `updateUserRole` for role updates.
- **Types**: `types/index.ts` includes `expires_at` in `User`.

## Files to Create/Modify
1. **lib/services/authService.ts** (Update) - Apply refined version with `userId`-based verification, debounced `last_login`, and simplified `initializeAuth`.
2. **routes/register/+page.server.ts** (New) - Verify Turnstile, call `registerUser`, send SendGrid email.
3. **routes/register/+page.svelte** (Modify) - Add `TurnstileWidget`, send `turnstileToken`.
4. **routes/login/+page.server.ts** (New) - Verify Turnstile, call `loginUser`.
5. **routes/login/+page.svelte** (Modify) - Add `TurnstileWidget`, send `turnstileToken`.
6. **routes/verify/+page.server.ts** (New) - Call `verifyUser` with `userId` and `magicKey`.
7. **routes/verify/+page.svelte** (New) - Auto-verify via URL params, redirect to `/login`.
8. **lib/components/auth/TurnstileWidget.svelte** (New) - Reusable Turnstile widget.
9. **lib/components/auth/RoleGuard.svelte** (New) - Restrict UI/routes by `user.role`.

## Implementation Steps
1. **lib/services/authService.ts**
   - Update with `userId`-based `verifyUser`, debounced `last_login` (100ms), and simplified `initializeAuth`.
2. **routes/register/+page.server.ts**
   - Verify Turnstile token using `<CLOUDFLARE_TURNSTILE_SECRET>`.
   - Call `registerUser` from `authService.ts`.
   - Send SendGrid email (`<SENDGRID_API_KEY>`) from `polycentricity@endogon.com` with link `https://localhost:5000/verify?userId=<user_id>&magicKey=<magic_key>`.
3. **routes/register/+page.svelte**
   - Integrate `TurnstileWidget` to capture `turnstileToken`.
   - Send `name`, `email`, `password`, `turnstileToken` to server.
   - Use Skeleton Labs classes (e.g., `bg-surface-50-950/90`).
   - Display “check email for verification” message post-registration.
4. **routes/login/+page.server.ts**
   - Verify Turnstile, call `loginUser`.
5. **routes/login/+page.svelte**
   - Use `TurnstileWidget`, send `turnstileToken`.
   - Implement with `$state`, `onsubmit`, defaults (`bjorn@endogon.com`, `admin123`).
6. **routes/verify/+page.server.ts**
   - Extract `userId`, `magicKey` from URL params, call `verifyUser`.
7. **routes/verify/+page.svelte**
   - Auto-verify on mount with `$effect`, redirect to `/login`.
   - Use Tailwind/Skeleton styling (e.g., `text-primary-500-400`).
8. **lib/components/auth/TurnstileWidget.svelte**
   - Load Turnstile script, dispatch `onverified`/`onerror` via `$props`.
   - Use `$effect` for script loading.
9. **lib/components/auth/RoleGuard.svelte**
   - Check `$userStore.user.role` with `$derived`.
   - Redirect to `redirectTo` if unauthorized.

## Integration with Existing Code
- **User Store**: Leverage `$userStore` (type `UserSession`) for reactive state.
- **Auth Service**: Utilize refined `registerUser`, `loginUser`, `verifyUser`, `initializeAuth`.
- **Game Service**: Use `updateUserRole` for role updates post-verification.
- **Routes**: Add `+page.server.ts` to `login` and `register`, update forms with `TurnstileWidget`.

## Notes
- **API Keys**: Use placeholders `<CLOUDFLARE_TURNSTILE_SITEKEY>`, `<CLOUDFLARE_TURNSTILE_SECRET>`, `<SENDGRID_API_KEY>` (to be provided).
- **Security**:
  - Use `generateId` for `magic_key`.
  - Enforce 24-hour expiration via `expires_at`.
  - Use HTTPS for verification links.
- **Performance**:
  - Debounce `last_login` writes (100ms).
  - Use `get`, `putSigned` for efficient Gun.js operations.
- **Testing**: Verify admin login (`bjorn@endogon.com`, `admin123`), `Guest` to `Member` upgrades, `RoleGuard` restrictions.

## Example Usage
- **Role Guard**:
  ```svelte
  <!-- src/routes/admin/+layout.svelte -->
  <RoleGuard allowedRoles={['Admin']} redirectTo="/login">
    {#snippet children()}
      <slot />
    {/snippet}
  </RoleGuard>
  ```
- **Verification Flow**:
  - User registers, receives email with `https://localhost:5000/verify?userId=<user_id>&magicKey=<magic_key>`.
  - Auto-verification sets `role: "Member"`, redirects to `/login`.

---

## Examle Implementation Code

### 2. routes/register/+page.server.ts (New)
```typescript
// src/routes/register/+page.server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { registerUser } from '$lib/services/authService';
import { sendVerificationEmail } from '$lib/services/emailService'; // Assume this exists or create it

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { name, email, password, turnstileToken } = await request.json();

    // Verify Turnstile token
    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: '<CLOUDFLARE_TURNSTILE_SECRET>',
        response: turnstileToken,
      }),
    });
    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResult.success) {
      return json({ error: 'Turnstile verification failed' }, { status: 400 });
    }

    // Register user
    const user = await registerUser(name, email, password);
    if (!user) {
      return json({ error: 'Registration failed' }, { status: 500 });
    }

    // Send verification email
    await sendVerificationEmail(email, user.user_id, user.magic_key!);

    return json({ success: true, userId: user.user_id });
  } catch (error) {
    console.error('Registration error:', error);
    return json({ error: 'Registration failed' }, { status: 500 });
  }
};
```

### 3. routes/register/+page.svelte (Modify)
```svelte
<!-- src/routes/register/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import TurnstileWidget from '$lib/components/auth/TurnstileWidget.svelte';
  import { registerUser } from '$lib/services/authService';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let turnstileToken = $state<string | null>(null);
  let error = $state<string | null>(null);
  let success = $state(false);

  async function handleSubmit() {
    if (!turnstileToken) {
      error = 'Please complete the Turnstile verification';
      return;
    }

    const user = await registerUser(name, email, password);
    if (user) {
      success = true;
      setTimeout(() => goto('/login'), 3000);
    } else {
      error = 'Registration failed';
    }
  }

  onMount(() => {
    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  });
</script>

{#if success}
  <p class="text-green-500">Registration successful! Check your email for verification.</p>
{:else}
  <form onsubmit|preventDefault={handleSubmit} class="space-y-4">
    <div>
      <label for="name" class="block">Name</label>
      <input id="name" type="text" bind:value={name} class="input" required />
    </div>
    <div>
      <label for="email" class="block">Email</label>
      <input id="email" type="email" bind:value={email} class="input" required />
    </div>
    <div>
      <label for="password" class="block">Password</label>
      <input id="password" type="password" bind:value={password} class="input" required />
    </div>
    <TurnstileWidget sitekey="<CLOUDFLARE_TURNSTILE_SITEKEY>" onverified={(e) => turnstileToken = e.detail} />
    {#if error}
      <p class="text-red-500">{error}</p>
    {/if}
    <button type="submit" class="btn variant-filled">Register</button>
  </form>
{/if}
```

### 4. routes/login/+page.server.ts (New)

```typescript
// src/routes/login/+page.server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { loginUser } from '$lib/services/authService';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, password, turnstileToken } = await request.json();

    // Verify Turnstile token
    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: '<CLOUDFLARE_TURNSTILE_SECRET>',
        response: turnstileToken,
      }),
    });
    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResult.success) {
      return json({ error: 'Turnstile verification failed' }, { status: 400 });
    }

    // Login user
    const user = await loginUser(email, password);
    if (!user) {
      return json({ error: 'Login failed' }, { status: 401 });
    }

    return json({ success: true, userId: user.user_id });
  } catch (error) {
    console.error('Login error:', error);
    return json({ error: 'Login failed' }, { status: 500 });
  }
};
```

### 5. routes/login/+page.svelte (Modify)

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import TurnstileWidget from '$lib/components/auth/TurnstileWidget.svelte';
  import { loginUser } from '$lib/services/authService';

  let email = $state('bjorn@endogon.com');
  let password = $state('admin123');
  let turnstileToken = $state<string | null>(null);
  let error = $state<string | null>(null);
  let success = $state(false);

  async function handleSubmit() {
    if (!turnstileToken) {
      error = 'Please complete the Turnstile verification';
      return;
    }

    const user = await loginUser(email, password);
    if (user) {
      success = true;
      goto('/dashboard');
    } else {
      error = 'Login failed';
    }
  }

  onMount(() => {
    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  });
</script>

{#if success}
  <p class="text-green-500">Login successful! Redirecting...</p>
{:else}
  <form onsubmit|preventDefault={handleSubmit} class="space-y-4">
    <div>
      <label for="email" class="block">Email</label>
      <input id="email" type="email" bind:value={email} class="input" required />
    </div>
    <div>
      <label for="password" class="block">Password</label>
      <input id="password" type="password" bind:value={password} class="input" required />
    </div>
    <TurnstileWidget sitekey="<CLOUDFLARE_TURNSTILE_SITEKEY>" onverified={(e) => turnstileToken = e.detail} />
    {#if error}
      <p class="text-red-500">{error}</p>
    {/if}
    <button type="submit" class="btn variant-filled">Login</button>
  </form>
{/if}
```

### 6. routes/verify/+page.server.ts (New)

```typescript
// src/routes/verify/+page.server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { verifyUser } from '$lib/services/authService';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');
    const magicKey = url.searchParams.get('magicKey');
    if (!userId || !magicKey) {
      return json({ error: 'Missing userId or magicKey' }, { status: 400 });
    }

    const success = await verifyUser(userId, magicKey);
    if (!success) {
      return json({ error: 'Verification failed' }, { status: 400 });
    }

    return json({ success: true });
  } catch (error) {
    console.error('Verification error:', error);
    return json({ error: 'Verification failed' }, { status: 500 });
  }
};
```

### 7. routes/verify/+page.svelte (New)

```svelte
<!-- src/routes/verify/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let error = $state<string | null>(null);
  let success = $state(false);

  onMount(async () => {
    const userId = $page.url.searchParams.get('userId');
    const magicKey = $page.url.searchParams.get('magicKey');
    if (!userId || !magicKey) {
      error = 'Invalid verification link';
      return;
    }

    const response = await fetch(`/api/verify?userId=${userId}&magicKey=${magicKey}`);
    const result = await response.json();
    if (result.success) {
      success = true;
      setTimeout(() => goto('/login'), 2000);
    } else {
      error = result.error || 'Verification failed';
    }
  });
</script>

{#if success}
  <p class="text-green-500">Verification successful! Redirecting to login...</p>
{:else if error}
  <p class="text-red-500">{error}</p>
{:else}
  <p>Verifying...</p>
{/if}
```

### 8. lib/components/auth/TurnstileWidget.svelte (New)

```svelte
<!-- src/lib/components/auth/TurnstileWidget.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  let { sitekey, onverified } = $props();

  onMount(() => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      window.turnstile.render('#turnstile-widget', {
        sitekey,
        callback: (token) => onverified(token),
      });
    };

    return () => {
      document.body.removeChild(script);
    };
  });
</script>

<div id="turnstile-widget"></div>
```

### 9. lib/components/auth/RoleGuard.svelte (New)

```svelte
<!-- src/lib/components/auth/RoleGuard.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores/userStore';

  let { allowedRoles, redirectTo, children } = $props();

  let hasAccess = $derived(
    $userStore.isAuthenticated && allowedRoles.includes($userStore.user?.role),
  );

  onMount(() => {
    if (!hasAccess) {
      goto(redirectTo);
    }
  });
</script>

{#if hasAccess}
  {@render children()}
{/if}
```
