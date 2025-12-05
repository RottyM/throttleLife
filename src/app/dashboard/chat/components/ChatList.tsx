
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Chat, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle, Users } from 'lucide-react';
import type { User } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface ChatListProps {
  chats: Chat[];
  currentUser: User | null;
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  isLoading: boolean;
  onNewGroup: () => void;
  allUsersMap: Map<string, UserProfile>;
}

export function ChatList({
  chats,
  currentUser,
  selectedChat,
  onSelectChat,
  isLoading,
  onNewGroup,
  allUsersMap,
}: ChatListProps) {

  if (isLoading) {
    return (
      <div className="h-full space-y-2 overflow-y-auto border-r p-4">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const sortedChats = [...chats].sort((a, b) => {
    // Handle both Firestore Timestamps and null/undefined values
    const getSortableDate = (chat: Chat): Date => {
      if (chat.lastUpdated instanceof Timestamp) {
        return chat.lastUpdated.toDate();
      }
      // If it's pending write or null, treat it as very old
      return new Date(0); 
    };

    const dateA = getSortableDate(a);
    const dateB = getSortableDate(b);

    return dateB.getTime() - dateA.getTime();
  });

  const getChatAvatar = (chat: Chat) => {
    const isGroup = chat.participantIds.length > 2 || chat.name;
    if (isGroup) {
      return (
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            <Users />
          </AvatarFallback>
        </Avatar>
      );
    }
    const otherUserId = chat.participantIds.find(id => id !== currentUser?.uid);
    const otherUser = otherUserId ? allUsersMap.get(otherUserId) : null;
    return (
      <Avatar className="h-10 w-10">
        <AvatarImage src={otherUser?.profilePicture || `https://i.pravatar.cc/150?u=${otherUserId}`} />
        <AvatarFallback>{otherUser?.firstName?.charAt(0)}</AvatarFallback>
      </Avatar>
    );
  };

  const getChatTitle = (chat: Chat) => {
    if (chat.name) return chat.name;
    const otherUserId = chat.participantIds.find(id => id !== currentUser?.uid);
    const otherUser = otherUserId ? allUsersMap.get(otherUserId) : null;
    return otherUser ? `${otherUser.firstName} ${otherUser.lastName}` : '1-on-1 Chat';
  }

  return (
    <Card className="h-full rounded-none border-b-0 border-l-0 border-t-0">
      <CardHeader className="flex-row items-center justify-between p-4">
        <h2 className="text-lg font-bold">Conversations</h2>
        <Button variant="ghost" size="icon" onClick={onNewGroup}>
          <PlusCircle className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="h-full space-y-1 overflow-y-auto p-2">
        {sortedChats.map((chat) => (
          <div
            key={chat.id}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors',
              selectedChat?.id === chat.id ? 'bg-muted' : 'hover:bg-muted/50'
            )}
            onClick={() => onSelectChat(chat)}
          >
            {getChatAvatar(chat)}
            <div className="flex-1 truncate">
              <p className="font-semibold">{getChatTitle(chat)}</p>
              <p className="truncate text-sm text-muted-foreground">
                {chat.lastMessage || 'No messages yet'}
              </p>
            </div>
            {chat.lastUpdated instanceof Timestamp && (
              <p className="self-start text-xs text-muted-foreground">
                {formatDistanceToNow(chat.lastUpdated.toDate(), {
                  addSuffix: true,
                })}
              </p>
            )}
          </div>
        ))}
        {sortedChats.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No conversations yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
