<script lang="ts">
        import '../app.css';
        import Header from '$lib/components/Header.svelte';
        import Footer from '$lib/components/Footer.svelte';
        import { onMount } from 'svelte';
        import { initializeGun } from '$lib/services/gunService';

        // Theme state
        let isDarkMode = $state<boolean>(false);

        // Function to apply theme
        function applyTheme() {
                const html = document.documentElement;
                if (isDarkMode) {
                        html.classList.add('dark');
                        html.style.colorScheme = 'dark';
                        localStorage.setItem('theme', 'dark');
                        console.log('Layout: Applied dark mode');
                } else {
                        html.classList.remove('dark');
                        html.style.colorScheme = 'light';
                        localStorage.setItem('theme', 'light');
                        console.log('Layout: Applied light mode');
                }
        }

        // Toggle theme function to export to header
        export function toggleTheme() {
                isDarkMode = !isDarkMode;
                applyTheme();
        }

        onMount(() => {
                // Initialize Gun.js when app loads
                initializeGun();
                
                // Check localStorage for saved preference
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme) {
                        isDarkMode = savedTheme === 'dark';
                } else {
                        // Default to browser preference if no saved theme
                        isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                }
                applyTheme();
        });
</script>

<div class="flex flex-col min-h-screen">
        <Header {toggleTheme} />
        <main class="flex-grow container mx-auto p-4">
                <slot />
        </main>
        <Footer />
</div>
