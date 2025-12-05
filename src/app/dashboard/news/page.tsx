
'use client';

import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlayCircle, Database } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { VideoPlayer } from './video-player';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, where, writeBatch, doc } from 'firebase/firestore';
import type { NewsArticle } from '@/lib/types';
import { formatDistanceToNow, subMonths, startOfDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useMemoFirebase } from '@/firebase';

const NewsCardSkeleton = () => (
  <Card className="flex flex-col overflow-hidden">
    <CardHeader className="p-0">
      <Skeleton className="aspect-[3/2] w-full" />
    </CardHeader>
    <CardContent className="flex-1 p-6">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-2 h-12 w-full" />
    </CardContent>
    <CardFooter className="flex justify-between p-6 pt-0">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
    </CardFooter>
  </Card>
);

export default function NewsPage() {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const fetchNews = async () => {
    toast({
      title: 'Fetching Latest News...',
      description: 'Please wait while we gather the latest articles.',
    });

    try {
      const response = await fetch('/api/fetch-news');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'An unknown error occurred');
      }

      toast({
        title: 'Success!',
        description: `Fetched ${result.count} new articles. The page will now refresh.`,
      });

      // Wait a moment for toast to show before reloading
      setTimeout(() => window.location.reload(), 2000);

    } catch (error) {
      console.error('Error fetching news:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: 'Error',
        description: `Could not fetch news: ${errorMessage}`,
        variant: 'destructive',
      });
    }
  };

  const oneMonthAgo = useMemo(() => subMonths(startOfDay(new Date()), 1), []);

  const newsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'news_articles'),
            where('publishedAt', '>=', oneMonthAgo.toISOString()),
            orderBy('publishedAt', 'desc')
          )
        : null,
    [firestore, oneMonthAgo]
  );
  
  const { data: newsItems, isLoading } = useCollection<NewsArticle>(newsQuery);

  const handlePlayVideo = (videoId: string) => {
    setPlayingVideoId(videoId);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
            Latest Buzz
            </h1>
            <p className="text-muted-foreground">
            Your daily pit stop for what's new in the motorcycle world.
            </p>
        </div>
        <Button onClick={fetchNews}><Database className="mr-2 h-4 w-4" /> Fetch Latest News</Button>
      </header>
      <main className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading && (
          [...Array(4)].map((_, i) => <NewsCardSkeleton key={i} />)
        )}
        {newsItems?.map((item) => {
          const isVideo = !!item.videoUrl;
          const isPlaying = isVideo && playingVideoId === item.id;
          
          return (
            <Card
              key={item.id}
              className="flex flex-col overflow-hidden transition-all hover:shadow-lg group"
            >
              <CardHeader className="p-0">
                <div className="relative aspect-[3/2] w-full">
                  {isPlaying && isVideo ? (
                     <VideoPlayer videoUrl={item.videoUrl!} />
                  ) : item.imageUrl ? (
                    <>
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                      />
                      {isVideo && (
                        <div 
                          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40"
                          onClick={() => handlePlayVideo(item.id)}
                        >
                          <PlayCircle className="h-16 w-16 text-white/80 transition-transform group-hover:scale-110" />
                        </div>
                      )}
                    </>
                  ) : <Skeleton className="h-full w-full" />}
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-6">
                <CardTitle className="font-headline text-xl">
                  {!isVideo ? (
                    <Link href={`/dashboard/news/${item.id}`} className="hover:underline">
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </CardTitle>
                <CardDescription className="mt-2 line-clamp-3">
                  {item.description}
                </CardDescription>
              </CardContent>
              <CardFooter className="flex justify-between p-6 pt-0">
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
                </span>
                <Button variant="link" asChild className="p-0">
                  {isVideo ? (
                     <a href={item.videoUrl} target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
                  ) : (
                    <Link href={`/dashboard/news/${item.id}`}>Read More</Link>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
         {!isLoading && newsItems?.length === 0 && (
          <Card className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4">
              <CardContent className="p-8 text-center">
                  <h3 className="font-headline text-xl">No News Yet</h3>
                  <p className="text-muted-foreground mt-2">
                     Check back later for the latest buzz in the motorcycle world.
                  </p>
              </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
