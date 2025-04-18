import { redirect } from '@sveltejs/kit';

// Define our load function with proper typing
export async function load({ params }: { params: { gameId: string } }) {
    return {
        gameId: params.gameId
    };
};
