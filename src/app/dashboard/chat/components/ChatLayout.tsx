
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { UserProfile, Chat, ChatMessage } from '@/lib/types';
import { ChatList } from './ChatList';
import { ChatMessages } from './ChatMessages';
import { MessageInput } from './MessageInput';
import { useSearchParams } from 'next/navigation';
import { NewGroupDialog } from './NewGroupDialog';
import { useMemoFirebase } from '@/firebase';

export function ChatLayout() {
  const { firestore, user: currentUser } = useFirebase();
  const searchParams = useSearchParams();
  const initialChatId = searchParams.get('chatId');

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isNewGroupDialogOpen, setIsNewGroupDialogOpen] = useState(false);

  // Query for all chats the current user is a part of
  const chatsQuery = useMemoFirebase(
    () =>
      firestore && currentUser
        ? query(
            collection(firestore, 'chats'),
            where('participantIds', 'array-contains', currentUser.uid)
          )
        : null,
    [firestore, currentUser]
  );
  const { data: chats, isLoading: chatsLoading } = useCollection<Chat>(chatsQuery);

  const usersQuery = useMemoFirebase(
    () => (firestore && currentUser ? query(collection(firestore, 'users'), where('id', '==', currentUser.uid)) : null),
    [firestore, currentUser]
  );
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);

  // Effect to set the initial chat from URL parameters
  useEffect(() => {
    if (initialChatId && chats) {
      const chat = chats.find((c) => c.id === initialChatId);
      if (chat) setSelectedChat(chat);
    }
  }, [initialChatId, chats]);

  const messagesQuery = useMemoFirebase(
    () =>
      firestore && selectedChat
        ? query(
            collection(firestore, `chats/${selectedChat.id}/messages`),
            orderBy('timestamp', 'asc')
          )
        : null,
    [firestore, selectedChat]
  );
  const { data: messages, isLoading: messagesLoading } =
    useCollection<ChatMessage>(messagesQuery);
    
  const allUsersMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    users?.forEach(user => map.set(user.id, user));
    return map;
  }, [users]);


  return (
    <>
    <div className="grid h-full grid-cols-[300px_1fr]">
      <ChatList
        chats={chats || []}
        currentUser={currentUser}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        isLoading={chatsLoading}
        onNewGroup={() => setIsNewGroupDialogOpen(true)}
        allUsersMap={allUsersMap}
      />
      <div className="flex flex-col border-l">
        {selectedChat && currentUser ? (
          <>
            <ChatMessages
              chat={selectedChat}
              messages={messages || []}
              currentUser={currentUser}
              allUsersMap={allUsersMap}
              isLoading={messagesLoading}
            />
            <MessageInput chat={selectedChat} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Select a conversation to begin.</p>
          </div>
        )}
      </div>
    </div>
    <NewGroupDialog
      open={isNewGroupDialogOpen}
      onOpenChange={setIsNewGroupDialogOpen}
      currentUser={currentUser}
      allUsers={users || []}
      onGroupCreated={setSelectedChat}
    />
    </>
  );
}
