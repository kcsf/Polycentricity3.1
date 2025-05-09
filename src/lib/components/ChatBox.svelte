<script lang="ts">
        import { onMount, onDestroy } from 'svelte';
        import type { ChatMessage } from '$lib/types';
        import { getCurrentUser } from '$lib/services/authService';
        import {
          subscribeToGroupChat,
          subscribeToPrivateChat,
          sendMessage,
          getGroupMessages,
          getPrivateMessages
        } from '$lib/services/chatService';
        import { formatTime, stringToColor, getInitials } from '$lib/utils/helpers';
      
        const {
          gameId,
          chatType = 'group' as 'group' | 'private',
          otherUserId = undefined as string | undefined,
          compact = false
        } = $props<{
          gameId: string;
          chatType?: 'group' | 'private';
          otherUserId?: string;
          compact?: boolean;
        }>();
      
        let messages = $state<ChatMessage[]>([]);
        let newMessageContent = $state('');
        let unsubscribe = $state<() => void>(() => {});
        let chatContainer = $state<HTMLElement>();
        let isLoading = $state(true);
      
        const currentUser = $state(getCurrentUser());
      
        onMount(async () => {
          try {
            // Load existing messages
            if (chatType === 'group') {
              messages = await getGroupMessages(gameId);
            } else if (chatType === 'private' && otherUserId) {
              messages = await getPrivateMessages(gameId, otherUserId);
            }
            // Subscribe to new messages
            if (chatType === 'group') {
              unsubscribe = subscribeToGroupChat(gameId, handleNewMessage);
            } else if (chatType === 'private' && otherUserId) {
              unsubscribe = subscribeToPrivateChat(gameId, otherUserId, handleNewMessage);
            }
            setTimeout(scrollToBottom, 100);
          } catch (error) {
            console.error('Error loading chat messages:', error);
            messages = [];
          } finally {
            isLoading = false;
          }
        });
      
        onDestroy(() => {
          unsubscribe();
        });
      
        function handleNewMessage(message: ChatMessage) {
          const exists = messages.some(m => m.message_id === message.message_id);
          if (!exists) {
            messages = [...messages, message].sort((a, b) => a.created_at - b.created_at);
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
          return currentUser?.user_id === userId;
        }
      </script>
      
      <div class="{!compact ? 'card' : ''} h-full flex flex-col">
        {#if !compact}
          <header class="card-header p-4 flex items-center justify-between border-b border-surface-300 dark:border-surface-600">
            <h3 class="h3">
              {#if chatType === 'group'}Group Chat{:else}Private Chat{/if}
            </h3>
          </header>
        {/if}
      
        <section class="p-2 flex-grow overflow-y-auto" bind:this={chatContainer}>
          {#if isLoading}
            <div class="flex items-center justify-center h-full">
              <p class="text-center opacity-50 text-{compact ? 'xs' : 'sm'}">Loading messages...</p>
            </div>
          {:else if messages.length === 0}
            <div class="flex items-center justify-center h-full">
              <p class="text-center opacity-50 text-{compact ? 'xs' : 'sm'}">No messages yet. Start the conversation!</p>
            </div>
          {:else}
            <div class="space-y-{compact ? '1' : '2'} p-{compact ? '1' : '2'}">
              {#each messages as message (message.message_id)}
                <div class="flex {isCurrentUser(message.sender_ref) ? 'justify-end' : 'justify-start'}">
                  <div
                    class="max-w-[80%] p-{compact ? '2' : '3'} rounded-lg {isCurrentUser(message.sender_ref)
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-200 dark:bg-surface-700'}"
                  >
                    {#if !isCurrentUser(message.sender_ref)}
                      <div class="flex items-center space-x-1 mb-1">
                        <div
                          class="w-{compact ? '4' : '6'} h-{compact ? '4' : '6'} rounded-full flex items-center justify-center text-white text-{compact ? '2xs' : 'xs'}"
                          style="background-color: {stringToColor(message.sender_ref)};"
                        >
                          {getInitials(message.sender_name)}
                        </div>
                        <span class="text-{compact ? 'xs' : 'sm'} font-medium">{message.sender_name}</span>
                      </div>
                    {/if}
                    <p class="break-words text-{compact ? 'xs' : 'base'}">{message.content}</p>
                    <p class="text-{compact ? '2xs' : 'xs'} text-right mt-1 opacity-70">{formatTime(message.created_at)}</p>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      
        <footer class="p-{compact ? '2' : '4'} border-t border-surface-300 dark:border-surface-600">
          <form onsubmit={(e) => { e.preventDefault(); handleSendMessage(); }} class="flex space-x-1">
            <input
              type="text"
              class="input input-{compact ? 'sm' : 'md'} w-full"
              placeholder="Type your message..."
              bind:value={newMessageContent}
            />
            <button type="submit" class="btn btn-{compact ? 'sm' : 'md'} bg-primary-500 text-white hover:bg-primary-600">
              {compact ? 'Send' : 'Send Message'}
            </button>
          </form>
        </footer>
      </div>