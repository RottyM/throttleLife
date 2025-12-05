
import type { User } from 'firebase/auth';
import type { Chat, UserProfile } from '@/lib/types';
import { doc, setDoc, addDoc, getDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export const getOneOnOneChatId = (userId1: string, userId2: string) => {
  return [userId1, userId2].sort().join('_');
};

/**
 * Finds or creates a one-on-one chat between the current user and another user.
 * @returns The Chat object.
 */
export const findOrCreateOneOnOneChat = async (
    firestore: Firestore,
    currentUser: User,
    otherUser: UserProfile
): Promise<Chat> => {
    const chatId = getOneOnOneChatId(currentUser.uid, otherUser.id);
    const chatRef = doc(firestore, 'chats', chatId);

    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
        return { id: chatSnap.id, ...chatSnap.data() } as Chat;
    } else {
        const newChatData = {
            participantIds: [currentUser.uid, otherUser.id],
            createdBy: currentUser.uid,
            lastUpdated: serverTimestamp(),
            lastMessage: `Chat with ${otherUser.firstName} started.`,
        };
        await setDoc(chatRef, newChatData);
        return {
            id: chatId,
            ...newChatData
        } as Chat;
    }
};


    