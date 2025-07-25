<script lang="ts">
        import type { User } from '$lib/types';
        import { getInitials, stringToColor } from '$lib/utils/helpers';
        import { UserCog } from '@lucide/svelte';

        const { user, showDetails = true, onUpdateProfile = () => {} } = $props<{
                user: User;
                showDetails?: boolean;
                onUpdateProfile?: () => void;
        }>();

        const initials = $derived(getInitials(user.name));
        const avatarColor = $derived(stringToColor(user.user_id));
        const joinedDate = $derived(new Date(user.created_at).toLocaleDateString());
</script>

<div class="card shadow-sm overflow-hidden">
        <h2 class="sr-only" id="profile-overview-title">Profile Overview</h2>
        
        <div class="p-6">
                <div class="sm:flex sm:items-center sm:justify-between">
                        <div class="sm:flex sm:space-x-5">
                                <div class="shrink-0">
                                        <div 
                                                class="mx-auto size-20 rounded-full flex items-center justify-center text-white font-bold"
                                                style="background-color: {avatarColor};"
                                        >
                                                {initials}
                                        </div>
                                </div>
                                
                                <div class="mt-4 text-center sm:mt-0 sm:pt-1 sm:text-left">
                                        <p class="text-sm font-medium text-surface-600-300">Welcome back,</p>
                                        <p class="text-xl font-bold sm:text-2xl">{user.name}</p>
                                        <p class="text-sm font-medium text-surface-600-300">{user.email}</p>
                                </div>
                        </div>
                        
                        <div class="mt-5 flex justify-center sm:mt-0">
                                <button 
                                        class="btn variant-soft-surface flex items-center justify-center"
                                        onclick={onUpdateProfile}
                                >
                                        <UserCog class="mr-2 h-4 w-4" />
                                        <span>Update Profile</span>
                                </button>
                        </div>
                </div>
        </div>
        
        {#if showDetails}
                <div class="grid grid-cols-1 divide-y border-t sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                        <div class="px-6 py-5 text-center text-sm font-medium">
                                <span class="block text-xl text-tertiary-600-300">{user.role || 'Player'}</span>
                                <span class="text-surface-600-300">Role</span>
                        </div>
                        <div class="px-6 py-5 text-center text-sm font-medium">
                                <span class="block text-xl text-tertiary-600-300">{joinedDate}</span>
                                <span class="text-surface-600-300">Joined</span>
                        </div>
                        <div class="px-6 py-5 text-center text-sm font-medium overflow-hidden">
                                <span class="block text-xs text-tertiary-600-300 truncate">{user.user_id}</span>
                                <span class="text-surface-600-300">User ID</span>
                        </div>
                </div>
        {/if}
</div>