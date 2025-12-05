
'use client';

import Image from 'next/image';
import { notFound, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import React, { useMemo } from 'react';
import { useFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { NewsArticle } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useMemoFirebase } from '@/firebase';


const NewsArticlePageSkeleton = () => (
  <div className="flex-1 space-y-4 p-4 md:p-8">
     <Skeleton className="h-6 w-32" />
    <main className="mx-auto max-w-3xl">
      <Card>
          <CardHeader className="p-0">
            <Skeleton className="aspect-video w-full rounded-t-lg" />
          </CardHeader>
        <CardContent className="p-6 md:p-8">
          <div className="mb-4 flex items-center gap-4">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-24" />
          </div>
           <Skeleton className="h-10 w-3/4" />
           <Skeleton className="mt-6 h-5 w-full" />
           <Skeleton className="mt-2 h-5 w-full" />
           <Skeleton className="mt-2 h-5 w-4/5" />
           <Skeleton className="mt-4 h-5 w-full" />
           <Skeleton className="mt-2 h-5 w-2/3" />
        </CardContent>
      </Card>
    </main>
  </div>
);


export default function NewsArticlePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { firestore } = useFirebase();

  const articleRef = useMemoFirebase(
    () => (firestore && id ? doc(firestore, 'news_articles', id) : null),
    [firestore, id]
  );
  
  const { data: article, isLoading } = useDoc<NewsArticle>(articleRef);


  // While loading, show a skeleton
  if (isLoading) {
    return <NewsArticlePageSkeleton />;
  }
  
  // After loading, if there's no article, then it's a 404
  if (!isLoading && !article) {
    notFound();
  }

  // If we have an article, render it
  // The 'article' object can be safely accessed from here on
  if (article) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8">
         <header className="flex items-center gap-4">
          <Link href="/dashboard/news" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to News</span>
          </Link>
        </header>
        <main className="mx-auto max-w-3xl">
          <Card>
            {article.imageUrl && (
              <CardHeader className="p-0">
                <div className="relative aspect-video w-full overflow-hidden rounded-t-lg">
                  <Image
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    className="object-cover"
                  />
                </div>
              </CardHeader>
            )}
            <CardContent className="p-6 md:p-8">
              <div className="mb-4 flex items-center gap-4">
                  <Badge variant="secondary">Article</Badge>
                  <p className="text-sm text-muted-foreground">
                      {format(new Date(article.publishedAt), 'MMMM d, yyyy')}
                  </p>
              </div>
              <CardTitle className="font-headline text-3xl md:text-4xl">
                {article.title}
              </CardTitle>
              <CardDescription className="mt-6 text-base leading-relaxed">
                {article.description}
              </CardDescription>
               <CardDescription className="mt-4 text-base leading-relaxed">
               This is where the full article content would be displayed. In a real application, this would be fetched from a CMS or a database. For now, we're just showing the description again to demonstrate the page structure.
              </CardDescription>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Fallback, though the logic above should handle all cases.
  return <NewsArticlePageSkeleton />;
}
