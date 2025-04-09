<script lang="ts">
        import { userStore } from '$lib/stores/userStore';
        import { logoutUser } from '$lib/services/authService';
        import { goto } from '$app/navigation';
        
        function handleLogout() {
                logoutUser();
                goto('/');
        }
</script>

<header class="bg-gray-800 text-white p-4">
        <div class="container mx-auto flex justify-between items-center">
                <a href="/" class="text-xl font-bold">
                        <span class="text-green-400">Polycentricity3</span>
                </a>
                
                <nav>
                        <!-- For development: always show navigation links -->
                        <div class="hidden md:flex items-center space-x-4">
                                <a href="/dashboard" class="hover:text-green-300">Dashboard</a>
                                <a href="/games" class="hover:text-green-300">Games</a>
                                
                                {#if $userStore.isAuthenticated}
                                    <button class="text-red-300 hover:text-red-100" on:click={handleLogout}>Logout</button>
                                {:else}
                                    <a href="/login" class="hover:text-green-300">Login</a>
                                    <a href="/register" class="bg-green-500 hover:bg-green-700 px-3 py-1 rounded">Register</a>
                                {/if}
                        </div>
                        
                        <div class="md:hidden">
                                <button class="text-white">
                                        Menu
                                </button>
                        </div>
                </nav>
        </div>
</header>
