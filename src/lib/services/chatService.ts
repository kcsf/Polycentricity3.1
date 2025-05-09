import { getGun, nodes, generateId } from './gunService';
import { getCurrentUser } from './authService';
import type { ChatMessage } from '$lib/types';

// Helpers to build chat IDs
type ChatId = string;
const groupChatId = (gameId: string): ChatId => `chat_g_${gameId}`;
const privateChatId = (gameId: string, userId: string, otherUserId: string): ChatId =>
  `chat_private_u_${userId}_${otherUserId}`;

// Send a message to a game chat
export async function sendMessage(
  gameId: string,
  content: string,
  type: 'group' | 'private' = 'group',
  recipientId?: string
): Promise<ChatMessage | null> {
  const gun = getGun();
  const user = getCurrentUser();
  if (!gun || !user) return null;

  const messageId = generateId();
  const chatId: ChatId =
    type === 'group' ? groupChatId(gameId) : privateChatId(gameId, user.user_id, recipientId!);
  const now = Date.now();
  const message: ChatMessage = {
    message_id: messageId,
    chat_ref: chatId,
    game_ref: gameId,
    sender_ref: user.user_id,
    sender_name: user.name,
    content,
    type,
    recipient_ref: type === 'private' ? recipientId : undefined,
    read_by_ref: { [user.user_id]: true },
    created_at: now,
  };

  // Write the message under chat_messages/<chatId>/<messageId>
  gun.get(nodes.chat_messages).get(chatId).get(messageId).put(message);
  return message;
}

// Internal helper to fetch messages for a given chatId
async function fetchMessages(chatId: ChatId): Promise<ChatMessage[]> {
  const gun = getGun();
  const messages: ChatMessage[] = [];
  if (!gun) return messages;

  await new Promise<void>((resolve) => {
    gun
      .get(nodes.chat_messages)
      .get(chatId)
      .map()
      .once((data: any, key?: string) => {
        if (typeof data !== 'object' || data === null) return;
        if (!('content' in data)) return; // skip nested updates
        messages.push({ ...data, message_id: key! });
      });
    setTimeout(resolve, 500);
  });

  return messages;
}

// Get messages from a group chat
export async function getGroupMessages(
  gameId: string
): Promise<ChatMessage[]> {
  const msgs = await fetchMessages(groupChatId(gameId));
  return msgs.sort((a, b) => a.created_at - b.created_at);
}

// Get messages from a private chat
export async function getPrivateMessages(
  gameId: string,
  otherUserId: string
): Promise<ChatMessage[]> {
  const user = getCurrentUser();
  if (!user) return [];
  const chatId1 = privateChatId(gameId, user.user_id, otherUserId);
  const chatId2 = privateChatId(gameId, otherUserId, user.user_id);

  const [msgs1, msgs2] = await Promise.all([
    fetchMessages(chatId1),
    fetchMessages(chatId2),
  ]);

  return [...msgs1, ...msgs2].sort((a, b) => a.created_at - b.created_at);
}

// Subscribe to group chat messages
export function subscribeToGroupChat(
  gameId: string,
  callback: (message: ChatMessage) => void
): () => void {
  const gun = getGun();
  if (!gun) return () => {};

  const listener = gun
    .get(nodes.chat_messages)
    .get(groupChatId(gameId))
    .map()
    .on((data: any, key?: string) => {
      if (typeof data !== 'object' || data === null) return;
      if (!('content' in data)) return; // skip nested field updates
      callback({ ...data, message_id: key! });
    });

  return () => listener.off();
}

// Subscribe to private chat messages
export function subscribeToPrivateChat(
  gameId: string,
  otherUserId: string,
  callback: (message: ChatMessage) => void
): () => void {
  const gun = getGun();
  const user = getCurrentUser();
  if (!gun || !user) return () => {};

  const sub1 = gun
    .get(nodes.chat_messages)
    .get(privateChatId(gameId, user.user_id, otherUserId))
    .map()
    .on((data: any, key?: string) => {
      if (typeof data !== 'object' || data === null) return;
      if (!('content' in data)) return;
      callback({ ...data, message_id: key! });
    });

  const sub2 = gun
    .get(nodes.chat_messages)
    .get(privateChatId(gameId, otherUserId, user.user_id))
    .map()
    .on((data: any, key?: string) => {
      if (typeof data !== 'object' || data === null) return;
      if (!('content' in data)) return;
      callback({ ...data, message_id: key! });
    });

  return () => {
    sub1.off();
    sub2.off();
  };
}

// Get all chat participants in a game
export async function getChatParticipants(
  gameId: string
): Promise<string[]> {
  const gun = getGun();
  if (!gun) return [];

  return new Promise((resolve) => {
    gun
      .get(nodes.games)
      .get(gameId)
      .get('players')
      .once((players: Record<string, boolean>) => {
        resolve(players ? Object.keys(players) : []);
      });
  });
}
