import { getGun, nodes, generateId } from './gunService';
import { getCurrentUser } from './authService';
import type { ChatMessage, ChatRoom } from '$lib/types';

// Send a message to a game chat
export async function sendMessage(gameId: string, content: string, type: 'group' | 'private' = 'group', recipientId?: string): Promise<ChatMessage | null> {
    try {
        console.log(`Sending message to ${type} chat in game ${gameId}`);
        const gun = getGun();
        const currentUser = getCurrentUser();
        
        if (!gun || !currentUser) {
            console.error('Gun or user not initialized');
            return null;
        }
        
        const messageId = generateId();
        const message: ChatMessage = {
            id: messageId,
            game_id: gameId,
            user_id: currentUser.user_id,
            user_name: currentUser.name,
            content,
            timestamp: Date.now(),
            type,
            recipient_id: recipientId
        };
        
        // Determine the chat node path
        const chatNode = type === 'group' 
            ? `${nodes.chat}:${gameId}:group` 
            : `${nodes.chat}:${gameId}:private:${currentUser.user_id}:${recipientId}`;
        
        return new Promise((resolve, reject) => {
            gun.get(chatNode).get(messageId).put(message, (ack: any) => {
                if (ack.err) {
                    console.error('Error sending message:', ack.err);
                    reject(ack.err);
                    return;
                }
                
                console.log(`Message sent to ${type} chat in game ${gameId}`);
                resolve(message);
            });
        });
    } catch (error) {
        console.error('Send message error:', error);
        return null;
    }
}

// Get messages from a group chat
export async function getGroupMessages(gameId: string): Promise<ChatMessage[]> {
    try {
        console.log(`Getting group messages for game ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return [];
        }
        
        const chatNode = `${nodes.chat}:${gameId}:group`;
        
        return new Promise((resolve) => {
            const messages: ChatMessage[] = [];
            gun.get(chatNode).map().once((message: ChatMessage, messageId: string) => {
                if (message && messageId !== '_') {
                    messages.push(message);
                }
            });
            
            // Use setTimeout to give Gun time to fetch data
            setTimeout(() => {
                // Sort messages by timestamp
                messages.sort((a, b) => a.timestamp - b.timestamp);
                console.log(`Retrieved ${messages.length} group messages for game ${gameId}`);
                resolve(messages);
            }, 500);
        });
    } catch (error) {
        console.error('Get group messages error:', error);
        return [];
    }
}

// Get messages from a private chat
export async function getPrivateMessages(gameId: string, otherUserId: string): Promise<ChatMessage[]> {
    try {
        console.log(`Getting private messages between current user and ${otherUserId} in game ${gameId}`);
        const gun = getGun();
        const currentUser = getCurrentUser();
        
        if (!gun || !currentUser) {
            console.error('Gun or user not initialized');
            return [];
        }
        
        const chatNode1 = `${nodes.chat}:${gameId}:private:${currentUser.user_id}:${otherUserId}`;
        const chatNode2 = `${nodes.chat}:${gameId}:private:${otherUserId}:${currentUser.user_id}`;
        
        const messages1 = await new Promise<ChatMessage[]>((resolve) => {
            const messages: ChatMessage[] = [];
            gun.get(chatNode1).map().once((message: ChatMessage, messageId: string) => {
                if (message && messageId !== '_') {
                    messages.push(message);
                }
            });
            
            setTimeout(() => resolve(messages), 250);
        });
        
        const messages2 = await new Promise<ChatMessage[]>((resolve) => {
            const messages: ChatMessage[] = [];
            gun.get(chatNode2).map().once((message: ChatMessage, messageId: string) => {
                if (message && messageId !== '_') {
                    messages.push(message);
                }
            });
            
            setTimeout(() => resolve(messages), 250);
        });
        
        // Combine and sort all messages
        const allMessages = [...messages1, ...messages2].sort((a, b) => a.timestamp - b.timestamp);
        console.log(`Retrieved ${allMessages.length} private messages between users in game ${gameId}`);
        return allMessages;
    } catch (error) {
        console.error('Get private messages error:', error);
        return [];
    }
}

// Subscribe to group chat messages
export function subscribeToGroupChat(gameId: string, callback: (message: ChatMessage) => void): () => void {
    try {
        console.log(`Subscribing to group chat for game ${gameId}`);
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return () => {};
        }
        
        const chatNode = `${nodes.chat}:${gameId}:group`;
        
        const subscription = gun.get(chatNode).map().on((message: ChatMessage, messageId: string) => {
            if (message && messageId !== '_') {
                callback(message);
            }
        });
        
        return () => {
            console.log(`Unsubscribing from group chat for game ${gameId}`);
            subscription.off();
        };
    } catch (error) {
        console.error('Subscribe to group chat error:', error);
        return () => {};
    }
}

// Subscribe to private chat messages
export function subscribeToPrivateChat(gameId: string, otherUserId: string, callback: (message: ChatMessage) => void): () => void {
    try {
        console.log(`Subscribing to private chat with ${otherUserId} in game ${gameId}`);
        const gun = getGun();
        const currentUser = getCurrentUser();
        
        if (!gun || !currentUser) {
            console.error('Gun or user not initialized');
            return () => {};
        }
        
        const chatNode1 = `${nodes.chat}:${gameId}:private:${currentUser.user_id}:${otherUserId}`;
        const chatNode2 = `${nodes.chat}:${gameId}:private:${otherUserId}:${currentUser.user_id}`;
        
        const subscription1 = gun.get(chatNode1).map().on((message: ChatMessage, messageId: string) => {
            if (message && messageId !== '_') {
                callback(message);
            }
        });
        
        const subscription2 = gun.get(chatNode2).map().on((message: ChatMessage, messageId: string) => {
            if (message && messageId !== '_') {
                callback(message);
            }
        });
        
        return () => {
            console.log(`Unsubscribing from private chat with ${otherUserId} in game ${gameId}`);
            subscription1.off();
            subscription2.off();
        };
    } catch (error) {
        console.error('Subscribe to private chat error:', error);
        return () => {};
    }
}

// Get all chat participants in a game
export async function getChatParticipants(gameId: string): Promise<string[]> {
    try {
        console.log(`Getting chat participants for game ${gameId}`);
        
        // This will get the game and extract player IDs
        const gun = getGun();
        
        if (!gun) {
            console.error('Gun not initialized');
            return [];
        }
        
        return new Promise((resolve) => {
            gun.get(nodes.games).get(gameId).get('players').once((players: string[]) => {
                if (!players || !Array.isArray(players)) {
                    console.log(`No players found for game ${gameId}`);
                    resolve([]);
                    return;
                }
                
                console.log(`Retrieved ${players.length} chat participants for game ${gameId}`);
                resolve(players);
            });
        });
    } catch (error) {
        console.error('Get chat participants error:', error);
        return [];
    }
}
