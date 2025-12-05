
'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useUser, useFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import PhotoUpload from '@/components/PhotoUpload';
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from 'firebase/firestore';
import { GalleryMedia } from '@/lib/types';
import { Video, PlayCircle, Trash2, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ref, deleteObject } from 'firebase/storage';

export default function GalleryPage() {
  const { user, firestore, storage } = useFirebase();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<GalleryMedia | null>(null);
  const [firstPageItems, setFirstPageItems] = useState<GalleryMedia[]>([]);
  const [extraItems, setExtraItems] = useState<GalleryMedia[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedMoreRef = useRef(false);
  const PAGE_SIZE = 12;

  useEffect(() => {
    if (!firestore) return;

    setIsInitialLoading(true);
    const mediaQuery = query(
      collection(firestore, 'gallery'),
      orderBy('timestamp', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      mediaQuery,
      (snapshot) => {
        const pageItems = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as GalleryMedia),
          id: docSnap.id,
        }));

        setFirstPageItems(pageItems);

        if (!hasLoadedMoreRef.current) {
          setLastVisible(snapshot.docs[snapshot.docs.length - 1] ?? null);
          setHasMore(snapshot.docs.length === PAGE_SIZE);
        }

        setIsInitialLoading(false);
      },
      (error) => {
        console.error('Error loading gallery items:', error);
        toast({
          title: 'Error loading gallery',
          description: 'We could not load the latest gallery items.',
          variant: 'destructive',
        });
        setIsInitialLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, toast]);

  const loadMoreMedia = useCallback(async () => {
    if (!firestore || isLoadingMore || !lastVisible || !hasMore) return;

    setIsLoadingMore(true);
    hasLoadedMoreRef.current = true;

    try {
      const nextQuery = query(
        collection(firestore, 'gallery'),
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(nextQuery);
      const newItems = snapshot.docs.map((docSnap) => ({
        ...(docSnap.data() as GalleryMedia),
        id: docSnap.id,
      }));

      setExtraItems((prev) => {
        const existingIds = new Set([...firstPageItems, ...prev].map((item) => item.id));
        const filtered = newItems.filter((item) => !existingIds.has(item.id));
        return [...prev, ...filtered];
      });

      setLastVisible(snapshot.docs[snapshot.docs.length - 1] ?? lastVisible);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more media:', error);
      toast({
        title: 'Error loading more',
        description: 'Could not load additional media right now.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [firestore, firstPageItems, hasMore, isLoadingMore, lastVisible, toast]);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const target = loadMoreSentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreMedia();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMoreMedia]);

  const mediaItems = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...firstPageItems, ...extraItems].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return merged;
  }, [firstPageItems, extraItems]);

  const handleDeleteClick = (media: GalleryMedia) => {
    setSelectedMedia(media);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedMedia || !firestore || !storage) return;

    try {
      // Delete the Firestore document
      await deleteDoc(doc(firestore, 'gallery', selectedMedia.id));

      // Delete the file from Firebase Storage
      if (selectedMedia.mediaUrl) {
        const storageRef = ref(storage, selectedMedia.mediaUrl);
        await deleteObject(storageRef);
      }

      toast({
        title: "Success",
        description: "The media has been deleted.",
      });
    } catch (error) {
      console.error("Error deleting media:", error);
      toast({
        title: "Error",
        description: "Failed to delete the media. Please try again.",
        variant: "destructive",
      });
    } finally {
      setFirstPageItems((prev) => prev.filter((item) => item.id !== selectedMedia.id));
      setExtraItems((prev) => prev.filter((item) => item.id !== selectedMedia.id));
      setIsDeleteDialogOpen(false);
      setSelectedMedia(null);
    }
  };
  
  if (isInitialLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <header>
          <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
            Photo & Video Gallery
          </h1>
          <p className="text-muted-foreground">
            A collection of moments from the open road.
          </p>
        </header>
        <main className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <header className='space-y-2'>
          <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
            Photo & Video Gallery
          </h1>
          <p className="text-muted-foreground">
            A collection of moments from the open road.
          </p>
          <PhotoUpload />
        </header>
        <main className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {mediaItems?.map((media) => {
            const isOwner = user?.uid === media.userId;
            const displayMediaUrl = media.mediaUrl || media.imageUrl || media.videoUrl;
            const displayMediaType = media.mediaType || (media.imageUrl ? 'image' : media.videoUrl ? 'videoUrl' : 'video');
            const displayDescription = media.description || 'No description';

            if (!displayMediaUrl) return null;

            return (
              <Card key={media.id} className="group overflow-hidden relative aspect-square">
                <Link
                  href={{
                    pathname: `/dashboard/gallery/${media.id}`,
                    query: { mediaUrl: displayMediaUrl, mediaType: displayMediaType, description: displayDescription },
                  }}
                  className="absolute inset-0"
                  aria-label={`View media: ${displayDescription}`}
                >
                  {displayMediaType === 'image' && (
                    <Image
                      src={displayMediaUrl}
                      alt={displayDescription}
                      fill
                      className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                   {displayMediaType === 'video' && (
                    <div className="relative flex h-full w-full items-center justify-center bg-black">
                      <video
                        src={displayMediaUrl}
                        controls={false}
                        className="object-cover w-full h-full opacity-60"
                        preload="metadata"
                      />
                      <PlayCircle className="absolute h-1/4 w-1/4 text-white opacity-90 transition-transform duration-300 group-hover:scale-110" />
                    </div>
                  )}
                  {displayMediaType === 'videoUrl' && (
                     <div className="relative flex h-full w-full items-center justify-center bg-black">
                       <Video className="h-1/3 w-1/3 text-white opacity-70 absolute" />
                       <PlayCircle className="h-1/4 w-1/4 text-white opacity-90 transition-transform duration-300 group-hover:scale-110" />
                     </div>
                  )}
                </Link>
                
                {/* Overlay for description and delete button */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/60 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-sm text-white truncate pr-2">
                    {displayDescription}
                  </p>
                  {isOwner && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => handleDeleteClick(media)}
                      aria-label="Delete media"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </main>
        <div className="flex flex-col items-center gap-2 py-4">
          {hasMore ? (
            <Button
              onClick={loadMoreMedia}
              variant="secondary"
              disabled={isLoadingMore || !lastVisible}
              className="min-w-[180px]"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading more...
                </>
              ) : (
                'Load more'
              )}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have reached the end of the gallery.
            </p>
          )}
          <div ref={loadMoreSentinelRef} className="h-1 w-full" aria-hidden />
        </div>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the media from the gallery and storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
