'use client';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  useFirebase,
  useCollection,
  useUser,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
} from 'firebase/firestore';
import { notFound, useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CornerDownRight,
} from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { PhotoComment } from '@/lib/types';
import { useMemoFirebase } from '@/firebase';
import { CommentForm } from '@/components/CommentForm';

const CommentItem = ({
  comment,
  onReply,
}: {
  comment: PhotoComment;
  onReply: (commentId: string) => void;
}) => {
  const getCommentDate = () => {
    if (!comment.timestamp) return new Date(); // Fallback for pending writes
    // Firestore Timestamps have a `toDate` method, plain objects do not
    if (typeof comment.timestamp.toDate === 'function') {
      return comment.timestamp.toDate();
    }
    // Handle cases where it might be a string (though our type fix aims to prevent this)
    return new Date(comment.timestamp);
  };

  // Regular expression to find URLs that point to GIF images
  const gifRegex = /(https?:\/\/[^\s]+\.(gif))/g;

  // Function to render text content, converting GIF URLs to actual Image components
  const renderCommentContent = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    text.replace(gifRegex, (match, url, offset) => {
      // Add preceding text as a simple string
      if (offset > lastIndex) {
        parts.push(text.substring(lastIndex, offset));
      }
      // Add the GIF image
      parts.push(
        <div key={offset} className="relative mt-2 max-w-xs overflow-hidden rounded-md">
          <Image
            src={url}
            alt="GIF"
            width={300}
            height={200} // Adjust height as needed for GIFs
            className="h-auto w-full object-contain"
            unoptimized // GIFs are often not optimized by Next.js Image component
          />
        </div>
      );
      lastIndex = offset + match.length;
      return match;
    });

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts;
  };

  return (
    <div className="flex items-start gap-4">
      <Avatar className="h-10 w-10">
        <AvatarImage src={comment.userProfile?.profilePicture} />
        <AvatarFallback>
          {comment.userProfile?.userName?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{comment.userProfile?.userName}</p>
          <p className="text-xs text-muted-foreground">
            {comment.timestamp
              ? formatDistanceToNow(getCommentDate(), {
                  addSuffix: true,
                })
              : 'just now'}
          </p>
        </div>
        <p className="mt-1 text-sm">{renderCommentContent(comment.text)}</p>
        {comment.imageUrl && (
          <div className="relative mt-3 max-w-xs overflow-hidden rounded-md">
            <Image
              src={comment.imageUrl}
              alt="Comment attachment"
              width={320}
              height={240}
              className="h-auto w-full object-contain"
              unoptimized
            />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 gap-1 text-xs"
          onClick={() => onReply(comment.id)}
        >
          <CornerDownRight className="h-3 w-3" />
          Reply
        </Button>
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-4 border-l-2 pl-4">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} onReply={onReply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function PhotoDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUser();
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const mediaUrl = searchParams.get('mediaUrl');
  const mediaType = searchParams.get('mediaType');
  const mediaDescription = searchParams.get('description') || 'Gallery Item';

  const commentsQuery = useMemoFirebase(
    () =>
      firestore && id && user
        ? query(
            collection(firestore, 'gallery', id, 'comments'),
            orderBy('timestamp', 'desc')
          )
        : null,
    [firestore, id, user]
  );

  const { data: comments, isLoading: areCommentsLoading } =
    useCollection<PhotoComment>(commentsQuery);

  const handleReply = (commentId: string) => {
    setReplyTo(commentId);
  };
  
  const handleCommentAdded = () => {
    setReplyTo(null); // Close reply form after posting
  };

  // Organize comments into a thread
  const commentTree = useMemo(() => {
    if (!comments) return [];
    const commentMap = new Map<string, PhotoComment>();
    const rootComments: PhotoComment[] = [];
    comments.forEach(comment => {
        commentMap.set(comment.id, { ...comment, replies: [] });
    });
    comments.forEach(comment => {
        if (comment.parentId && commentMap.has(comment.parentId)) {
            commentMap.get(comment.parentId)?.replies?.push(commentMap.get(comment.id)!);
        } else {
            rootComments.push(commentMap.get(comment.id)!);
        }
    });
    return rootComments;
  }, [comments]);

  const isLoadingComments = isUserLoading || areCommentsLoading;

  if (!mediaUrl) {
    return <div>Media URL not provided.</div>;
  }
  
  const renderMedia = () => {
    if (mediaType === 'image') {
      return (
        <Image
          src={mediaUrl}
          alt={mediaDescription}
          fill
          className="object-contain"
        />
      );
    } else if (mediaType === 'video' || mediaType === 'videoUrl') {
      return (
        <video src={mediaUrl} controls className="h-full w-full object-contain" />
      );
    }
    return <div className="flex items-center justify-center h-full w-full text-muted-foreground">Unsupported Media Type</div>;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-8">
      <Card className="overflow-hidden">
        <div className="relative aspect-video w-full bg-black">
          {renderMedia()}
        </div>
        <CardHeader>
          <CardTitle className="font-headline">{mediaDescription}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Comments</CardTitle>
          <CardDescription>
            Join the conversation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CommentForm photoId={id} onCommentAdded={handleCommentAdded} />
          <div className="mt-6 space-y-6">
            {isUserLoading && <div>Loading comments...</div>}
            {!user && !isUserLoading && (
              <p className="text-center text-muted-foreground">
                Please log in to view comments.
              </p>
            )}
            {user && isLoadingComments && (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            )}
            {user && !isLoadingComments && commentTree.length === 0 && (
              <p className="text-center text-muted-foreground">
                No comments yet. Be the first!
              </p>
            )}
             {user && !isLoadingComments &&
              commentTree.map((comment) => (
                <div key={comment.id}>
                  <CommentItem comment={comment} onReply={handleReply} />
                   {replyTo === comment.id && (
                    <div className="mt-4 pl-14">
                      <CommentForm photoId={id} parentId={comment.id} onCommentAdded={handleCommentAdded} />
                    </div>
                  )}
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PhotoDetailPage() {
  return (
    <React.Suspense fallback={<div>Loading media...</div>}>
      <PhotoDetailContent />
    </React.Suspense>
  );
}
