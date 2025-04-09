<script lang="ts">
        import '../app.css';
        import Header from '$lib/components/Header.svelte';
        import Footer from '$lib/components/Footer.svelte';
        import { onMount } from 'svelte';
        import { initializeGun } from '$lib/services/gunService';

        onMount(() => {
                // Initialize Gun.js when app loads
                initializeGun();
        });
</script>

<div class="flex flex-col min-h-screen">
        <Header />
        <main class="flex-grow">
                <slot />
        </main>
        <Footer />
</div>
