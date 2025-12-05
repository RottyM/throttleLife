
'use client';

import { useUser, useFirebase } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import React, { useEffect, useMemo } from 'react';
import { findOrCreateOneOnOneChat } from './utils';
import { collection, query, getDocs } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useMemoFirebase } from '@/firebase';

const ChatLayout = dynamic(
  () => import('./ChatLayout').then(mod => mod.ChatLayout),
  { 
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center"><p>Loading Chat...</p></div>
  }
);


export default function ChatClientPage() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();
  const searchParams = useSearchParams();
  const router = useRouter();

  // This effect will run once to handle the initial navigation from the members page
  useEffect(() => {
    const createChatAndRedirect = async () => {
        // FIX: Ensure both firestore and user are available before proceeding
        if (!firestore || !user) return;
        
        const userId = searchParams.get('userId');
        const chatId = searchParams.get('chatId');

        // If we came from the members page with a userId, find/create the chat
        if (userId && !chatId) {
            // Fetch all users to find the profile for the given userId
            const usersQuery = query(collection(firestore, 'users'));
            const querySnapshot = await getDocs(usersQuery);
            const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
            const otherUser = users.find(u => u.id === userId);

            if (otherUser) {
                const chat = await findOrCreateOneOnOneChat(firestore, user, otherUser);
                // Redirect to the same page, but with the chatId, which will trigger a re-render
                router.push(`/dashboard/chat?chatId=${chat.id}`);
            }
        }
    };

    // Ensure this runs only when both firestore and user are ready
    if(firestore && user) {
      createChatAndRedirect();
    }

  }, [firestore, user, searchParams, router]);


  if (isUserLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4 md:p-8">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 md:p-8">
        <Card className="mt-8">
          <CardContent className="p-8 text-center">
            <h3 className="font-headline text-xl">Access Denied</h3>
            <p className="mt-2 mb-4 text-muted-foreground">
              You need to be logged in to view the chat.
            </p>
            <Button asChild>
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
       <header className="border-b p-4">
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
          Chat
        </h1>
        <p className="text-muted-foreground">
          Connect with your fellow riders.
        </p>
      </header>
      <main className="flex-1 overflow-hidden">
        <ChatLayout />
      </main>
    </div>
  );
}
