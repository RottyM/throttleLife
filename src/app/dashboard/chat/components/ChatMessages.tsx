
'use client';

import { useRef, useEffect, useMemo } from 'react';
import type { User } from 'firebase/auth';
import type { ChatMessage, UserProfile, Chat } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardHeader, Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { Users } from 'lucide-react';

interface ChatMessagesProps {
  chat: Chat;
  messages: ChatMessage[];
  currentUser: User;
  allUsersMap: Map<string, UserProfile>;
  isLoading: boolean;
}

export function ChatMessages({ chat, messages, currentUser, allUsersMap, isLoading }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const { chatPartner, isGroupChat } = useMemo(() => {
    const participantIds = chat.participantIds || [];
    const otherParticipants = participantIds.filter(id => id !== currentUser.uid);
    const isGroup = otherParticipants.length > 1 || chat.name;
    const partner = !isGroup && otherParticipants.length > 0 ? allUsersMap.get(otherParticipants[0]) : null;
    return { chatPartner: partner, isGroupChat: isGroup };
  }, [chat, currentUser, allUsersMap]);

  const getChatAvatar = () => {
    if (isGroupChat) {
      return (
        <Avatar className="h-10 w-10">
          <AvatarFallback><Users /></AvatarFallback>
        </Avatar>
      );
    }
    if (chatPartner) {
       return (
        <Avatar className="h-10 w-10">
          <AvatarImage src={chatPartner.profilePicture || `https://i.pravatar.cc/150?u=${chatPartner.id}`} alt={chatPartner.userName} />
          <AvatarFallback>
            {chatPartner.firstName?.charAt(0)}
            {chatPartner.lastName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
      );
    }
    return null;
  }
  
  const getChatTitle = () => {
    if (isGroupChat) return chat.name || 'Group Chat';
    if (chatPartner) return `${chatPartner.firstName} ${chatPartner.lastName}`;
    return 'Chat';
  }

  const getChatSubtitle = () => {
    if (isGroupChat) {
       const participantNames = chat.participantIds
        .map(id => allUsersMap.get(id)?.firstName || 'User')
        .join(', ');
      return `Participants: ${participantNames}`;
    }
    if (chatPartner) return `@${chatPartner.userName}`;
    return '';
  }


  return (
    <>
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          {getChatAvatar()}
          <div>
            <p className="font-semibold">{getChatTitle()}</p>
            <p className="text-sm text-muted-foreground truncate max-w-sm">{getChatSubtitle()}</p>
          </div>
        </div>
      </CardHeader>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && <p>Loading messages...</p>}
        {!isLoading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isCurrentUser = msg.senderId === currentUser.uid;
          const senderProfile = allUsersMap.get(msg.senderId);

          return (
            <div
              key={msg.id}
              className={cn('flex items-end gap-2', isCurrentUser ? 'justify-end' : 'justify-start')}
            >
              {!isCurrentUser && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={senderProfile?.profilePicture || `https://i.pravatar.cc/150?u=${senderProfile?.id}`} />
                  <AvatarFallback>{senderProfile?.firstName?.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
              <div>
                {!isCurrentUser && isGroupChat && senderProfile && (
                    <p className="text-xs text-muted-foreground mb-1 ml-1">{senderProfile.firstName}</p>
                )}
                <div
                    className={cn(
                    'max-w-xs rounded-lg px-4 py-2 md:max-w-md',
                    isCurrentUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                >
                    <p className="text-sm">{msg.message}</p>
                    <p className={cn("text-xs mt-1", isCurrentUser ? "text-primary-foreground/70": "text-muted-foreground")}>
                        {msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'p') : ''}
                    </p>
                </div>
              </div>
              {isCurrentUser && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser.photoURL || `https://i.pravatar.cc/150?u=${currentUser.uid}`} />
                   <AvatarFallback>{currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

    
