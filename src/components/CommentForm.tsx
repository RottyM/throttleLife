import { useFirebase, useUser } from "@/firebase/provider";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { LoaderCircle, Send, Smile, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';
import type { IGif } from "@giphy/js-types";

const EMOJIS = ['😀', '😎', '😂', '🤘', '🔥', '🏍️', '👏', '🎉', '👌', '🤯', '🙌', '💯'];

const gfFactory = (apiKey?: string) => (apiKey ? new GiphyFetch(apiKey) : null);

export function CommentForm({
  photoId,
  parentId = null,
  onCommentAdded,
}: {
  photoId: string;
  parentId?: string | null;
  onCommentAdded: () => void;
}) {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);

  const giphyApiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  const gf = useMemo(() => gfFactory(giphyApiKey), [giphyApiKey]);
  const giphyEnabled = Boolean(gf);

  const handleEmojiClick = (emoji: string) => {
    setCommentText((prev) => `${prev} ${emoji}`.trim());
  };

  const handleGifClick = (gif: IGif, e: React.SyntheticEvent<HTMLElement, Event>) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to comment.',
        variant: 'destructive',
      });
      return;
    }
    if (!gf) {
      toast({
        title: 'GIFs unavailable',
        description: 'Add NEXT_PUBLIC_GIPHY_API_KEY to enable GIF comments.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setShowGiphy(false);

    const commentsCollectionRef = collection(firestore, `gallery/${photoId}/comments`);
    const commentData = {
      photoId,
      userId: user.uid,
      text: '',
      timestamp: serverTimestamp(),
      imageUrl: gif.images.original.url,
      parentId,
      userProfile: {
        userName: user.displayName || user.email?.split('@')[0],
        profilePicture: user.photoURL || '',
      },
    };

    addDoc(commentsCollectionRef, commentData)
      .then(() => {
        onCommentAdded();
      })
      .catch((err: any) => {
        const isFirestoreError = err.code && err.code.startsWith('permission-denied');
        if (isFirestoreError) {
          const permissionError = new FirestorePermissionError({
            path: `gallery/${photoId}/comments`,
            operation: 'create',
            requestResourceData: { text: commentText },
          });
          errorEmitter.emit('permission-error', permissionError);
        }
        toast({
          title: 'Failed to post GIF',
          description: err.message || 'Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to comment.',
        variant: 'destructive',
      });
      return;
    }
    if (!commentText.trim()) return;

    setIsSubmitting(true);

    try {
      const commentsCollectionRef = collection(firestore, `gallery/${photoId}/comments`);

      const commentData = {
        photoId,
        userId: user.uid,
        text: commentText,
        timestamp: serverTimestamp(),
        imageUrl: '',
        parentId,
        userProfile: {
          userName: user.displayName || user.email?.split('@')[0],
          profilePicture: user.photoURL || '',
        },
      };

      await addDoc(commentsCollectionRef, commentData);

      setCommentText('');
      onCommentAdded();
    } catch (err: any) {
      const isFirestoreError = err.code && err.code.startsWith('permission-denied');
      if (isFirestoreError) {
        const permissionError = new FirestorePermissionError({
          path: `gallery/${photoId}/comments`,
          operation: 'create',
          requestResourceData: { text: commentText },
        });
        errorEmitter.emit('permission-error', permissionError);
      }
      toast({
        title: 'Failed to post comment',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchGifs = (offset: number) => {
    if (!gf) {
      return Promise.resolve({ data: [], pagination: { total_count: 0, count: 0, offset }, meta: { status: 200, msg: 'disabled', response_id: '' } } as any);
    }
    return gf.trending({ offset, limit: 10 });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          className="w-full resize-none pr-28"
          rows={1}
          disabled={isSubmitting}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                disabled={isSubmitting}
                aria-label="Add emoji"
              >
                <Smile />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-6 gap-1">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="rounded-md p-1 text-xl hover:bg-muted"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={showGiphy} onOpenChange={(open) => setShowGiphy(giphyEnabled && open)}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                disabled={isSubmitting || !giphyEnabled}
                aria-label="Add GIF"
                onClick={() => {
                  if (!giphyEnabled) {
                    toast({
                      title: 'GIFs unavailable',
                      description: 'Add NEXT_PUBLIC_GIPHY_API_KEY to enable GIF search.',
                    });
                  }
                }}
              >
                <FileImage />
              </Button>
            </PopoverTrigger>
            {giphyEnabled && (
              <PopoverContent className="w-[320px] p-2" align="end">
                <Grid width={300} columns={3} fetchGifs={fetchGifs} onGifClick={handleGifClick} noLink />
              </PopoverContent>
            )}
          </Popover>

          <Button
            type="submit"
            size="icon"
            className="h-8 w-8"
            disabled={isSubmitting || !commentText.trim()}
            aria-label="Send comment"
          >
            {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </div>
    </form>
  );
}
