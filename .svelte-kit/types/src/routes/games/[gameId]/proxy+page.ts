// @ts-nocheck
import type { PageLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load = async ({ params }: Parameters<PageLoad>[0]) => {
    return {
        gameId: params.gameId
    };
};
