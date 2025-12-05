
'use client';

import { useState } from 'react';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SendHorizonal } from 'lucide-react';
import type { Chat } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface MessageInputProps {
  chat: Chat;
}

export function MessageInput({ chat }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const { firestore, user } = useFirebase();

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !firestore || !user) return;

    const messagesCol = collection(firestore, `chats/${chat.id}/messages`);
    const chatDoc = doc(firestore, 'chats', chat.id);

    const messageData = {
      chatId: chat.id,
      senderId: user.uid,
      message: message.trim(),
      timestamp: serverTimestamp(),
      userProfile: {
        userName: user.displayName || user.email,
        profilePicture: user.photoURL,
      },
    };

    const chatUpdateData = {
      lastMessage: message.trim(),
      lastUpdated: serverTimestamp(),
    };

    // Add the message
    addDoc(messagesCol, messageData).catch((error) => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: messagesCol.path,
          operation: 'create',
          requestResourceData: messageData,
        })
      );
    });

    // Update the chat document with last message info
    setDoc(chatDoc, chatUpdateData, { merge: true }).catch((error) => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: chatDoc.path,
          operation: 'update',
          requestResourceData: chatUpdateData,
        })
      );
    });

    // TODO: Send notifications to other participants
    chat.participantIds
      .filter((id) => id !== user.uid)
      .forEach((participantId) => {
        const notificationCol = collection(
          firestore,
          `users/${participantId}/notifications`
        );
        const notificationData = {
          userId: participantId,
          type: 'NewMessage',
          message: `New message in ${chat.name || 'your chat'} from ${
            user.displayName || user.email
          }`,
          timestamp: serverTimestamp(),
          isRead: false,
          relatedEntityId: chat.id,
        };
        addDoc(notificationCol, notificationData).catch((error) => {
          console.error(`Failed to send notification to ${participantId}`, error);
          // Non-critical, so we don't emit a global error
        });
      });


    setMessage('');
  };

  return (
    <form
      onSubmit={handleSendMessage}
      className="flex items-center gap-2 border-t p-4"
    >
      <Input
        type="text"
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        autoComplete="off"
      />
      <Button type="submit" size="icon" disabled={!message.trim()}>
        <SendHorizonal className="h-5 w-5" />
      </Button>
    </form>
  );
}

    