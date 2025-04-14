<script lang="ts">
        import { onMount, onDestroy } from 'svelte';
        import type { ChatMessage } from '$lib/types';
        import { getCurrentUser } from '$lib/services/authService';
        import { subscribeToGroupChat, subscribeToPrivateChat, sendMessage, getGroupMessages, getPrivateMessages } from '$lib/services/chatService';
        import { formatTime, stringToColor, getInitials } from '$lib/utils/helpers';
        
        export let gameId: string;
        export let chatType: 'group' | 'private' = 'group';
        export let otherUserId: string | undefined = undefined;
        
        let messages: ChatMessage[] = [];
        let newMessageContent: string = '';
        let unsubscribe: () => void;
        let chatContainer: HTMLElement;
        let isLoading = true;
        
        // Get current user
        const currentUser = getCurrentUser();
        
        onMount(async () => {
                try {
                    // First load existing messages
                    if (chatType === 'group') {
                        messages = await getGroupMessages(gameId);
                    } else if (chatType === 'private' && otherUserId) {
                        messages = await getPrivateMessages(gameId, otherUserId);
                    }
                    
                    // Then subscribe to new messages
                    if (chatType === 'group') {
                        unsubscribe = subscribeToGroupChat(gameId, handleNewMessage);
                    } else if (chatType === 'private' && otherUserId) {
                        unsubscribe = subscribeToPrivateChat(gameId, otherUserId, handleNewMessage);
                    }
                } catch (error) {
                    console.error('Error loading chat messages:', error);
                    messages = []; // Ensure messages is initialized
                } finally {
                    isLoading = false;
                }
        });
        
        onDestroy(() => {
                if (unsubscribe) {
                        unsubscribe();
                }
        });
        
        // Handle new message coming in
        function handleNewMessage(message: ChatMessage) {
                // Check if message already exists in the array
                const exists = messages.some(m => m.id === message.id);
                
                if (!exists) {
                        messages = [...messages, message].sort((a, b) => a.timestamp - b.timestamp);
                        // Scroll to bottom on new message
                        setTimeout(scrollToBottom, 50);
                }
        }
        
        async function handleSendMessage() {
                if (!newMessageContent.trim()) return;
                
                if (chatType === 'group') {
                        await sendMessage(gameId, newMessageContent, 'group');
                } else if (chatType === 'private' && otherUserId) {
                        await sendMessage(gameId, newMessageContent, 'private', otherUserId);
                }
                
                newMessageContent = '';
        }
        
        function scrollToBottom() {
                if (chatContainer) {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                }
        }
        
        function isCurrentUser(userId: string): boolean {
                return currentUser && currentUser.user_id === userId;
        }
</script>

<div class="card h-full flex flex-col">
        <header class="card-header p-4 flex items-center justify-between border-b border-surface-300-600-token">
                <h3 class="h3">
                        {#if chatType === 'group'}
                                Group Chat
                        {:else}
                                Private Chat
                        {/if}
                </h3>
        </header>
        
        <section class="p-2 flex-grow overflow-y-auto" bind:this={chatContainer}>
                {#if !messages || messages.length === 0}
                        <div class="flex items-center justify-center h-full">
                                <p class="text-center opacity-50">No messages yet. Start the conversation!</p>
                        </div>
                {:else if isLoading}
                        <div class="flex items-center justify-center h-full">
                                <p class="text-center opacity-50">Loading messages...</p>
                        </div>
                {:else}
                        <div class="space-y-2 p-2">
                                {#each messages.filter(m => m && m.id) as message (message.id)}
                                        <div class="flex {isCurrentUser(message.user_id) ? 'justify-end' : 'justify-start'}">
                                                <div 
                                                        class="max-w-[80%] p-3 rounded-lg {isCurrentUser(message.user_id) 
                                                                ? 'bg-primary-500 text-white' 
                                                                : 'bg-surface-200-700-token'}"
                                                >
                                                        {#if !isCurrentUser(message.user_id)}
                                                                <div class="flex items-center space-x-2 mb-1">
                                                                        <div 
                                                                                class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                                                                                style="background-color: {stringToColor(message.user_id)};"
                                                                        >
                                                                                {getInitials(message.user_name)}
                                                                        </div>
                                                                        <span class="text-sm font-medium">{message.user_name}</span>
                                                                </div>
                                                        {/if}
                                                        <p class="break-words">{message.content}</p>
                                                        <p class="text-xs text-right mt-1 opacity-70">{formatTime(message.timestamp)}</p>
                                                </div>
                                        </div>
                                {/each}
                        </div>
                {/if}
        </section>
        
        <footer class="p-4 border-t border-surface-300-600-token">
                <form on:submit|preventDefault={handleSendMessage} class="flex space-x-2">
                        <input
                                type="text"
                                class="input w-full"
                                placeholder="Type your message..."
                                bind:value={newMessageContent}
                        />
                        <button type="submit" class="btn variant-filled-primary">Send</button>
                </form>
        </footer>
</div>
