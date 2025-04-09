import { join } from 'path';
import { skeleton } from '@skeletonlabs/tw-plugin';
import { fennec } from '@skeletonlabs/skeleton/themes';

/** @type {import('tailwindcss').Config} */
export default {
        darkMode: 'class',
        content: [
                './src/**/*.{html,js,svelte,ts}',
                join(require.resolve('@skeletonlabs/skeleton'), '../**/*.{html,js,svelte,ts}')
        ],
        theme: {
                extend: {},
        },
        // Tailwind CSS v4 configuration
        plugins: [
                skeleton({
                        themes: {
                                preset: [
                                        {
                                                name: 'fennec',
                                                enhancements: true,
                                                ...fennec
                                        }
                                ]
                        }
                })
        ]
};
