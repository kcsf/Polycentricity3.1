import { redirect } from '@sveltejs/kit';

// Disable prerendering for this dynamic route
export const prerender = false;

// Define our load function with proper typing
export async function load({ params }: { params: { gameId: string } }) {
    return {
        gameId: params.gameId
    };
};
