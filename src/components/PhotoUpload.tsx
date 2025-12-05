'use client';

import { useState, useRef } from 'react';
import { useFirebase, useUser } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileImage, Loader2, XCircle, Video, UploadCloud, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Image from 'next/image';

const PhotoUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { storage, firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setVideoUrl(''); // Clear video URL if a file is selected
    }
  };

  const handleVideoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoUrl(e.target.value);
    setSelectedFile(null); // Clear selected file if a video URL is entered
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setVideoUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to upload media.',
      });
      return;
    }

    if (!selectedFile && !videoUrl) {
      toast({
        title: 'Selection Required',
        description: 'Please select an image/video file or provide a video URL.',
      });
      return;
    }

    setUploading(true);

    try {
      let mediaUrl = '';
      let mediaType = '';

      if (selectedFile) {
        const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
        mediaType = fileExtension === 'mp4' || fileExtension === 'mov' || fileExtension === 'webm' ? 'video' : 'image';
        const storageRef = ref(storage, `gallery/${user.uid}/${selectedFile.name}`);
        const snapshot = await uploadBytes(storageRef, selectedFile);
        mediaUrl = await getDownloadURL(snapshot.ref);
      } else if (videoUrl) {
        mediaUrl = videoUrl;
        mediaType = 'videoUrl'; // Differentiate from uploaded video files
      }

      const galleryCollection = collection(firestore, 'gallery');
      await addDoc(galleryCollection, {
        userId: user.uid,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        description: description,
        timestamp: serverTimestamp(),
        userProfile: {
          userName: user.displayName || user.email?.split('@')[0],
          profilePicture: user.photoURL || '',
        },
      });

      toast({
        title: 'Upload Successful',
        description: 'Your media has been uploaded to the gallery.',
      });
      clearSelection();
      setDescription('');
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error uploading media:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'There was an error uploading your media.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const previewUrl = selectedFile ? URL.createObjectURL(selectedFile) : videoUrl;
  const isVideoFile = selectedFile && (selectedFile.type.startsWith('video/'));
  const isImageUrl = selectedFile && (selectedFile.type.startsWith('image/'));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5" /> Upload Media
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Photo or Video</DialogTitle>
          <DialogDescription>
            Share your moments from the road with the community.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add a description for your media..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
            />
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="media-file">Upload File</Label>
            <Input
              id="media-file"
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              disabled={uploading || !!videoUrl}
              ref={fileInputRef}
            />
          </div>

          <div className="relative flex items-center justify-center text-xs text-muted-foreground">
            <span className="absolute left-0 w-full border-b border-border" />
            <span className="relative bg-background px-2">OR</span>
            <span className="absolute right-0 w-full border-b border-border" />
          </div>

          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="video-url">Embed Video URL (YouTube, Vimeo, etc.)</Label>
            <Input
              id="video-url"
              type="url"
              placeholder="e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              value={videoUrl}
              onChange={handleVideoUrlChange}
              disabled={uploading || !!selectedFile}
            />
          </div>

          {(selectedFile || videoUrl) && (
            <div className="relative mt-4 rounded-md border border-dashed p-4 text-center">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 z-10 text-muted-foreground hover:text-foreground"
                onClick={clearSelection}
                disabled={uploading}
              >
                <XCircle className="h-5 w-5" />
              </Button>
              <h3 className="mb-2 text-sm font-medium">Preview:</h3>
              <div className="relative mx-auto h-48 w-full overflow-hidden rounded-md bg-gray-100 flex items-center justify-center">
                {isImageUrl && selectedFile && (
                  <Image
                    src={previewUrl}
                    alt="Selected preview"
                    fill
                    className="object-contain"
                  />
                )}
                {isVideoFile && selectedFile && (
                  <video src={previewUrl} controls className="h-full w-full object-contain" />
                )}
                {videoUrl && (
                  <div className="h-full w-full flex items-center justify-center bg-gray-200">
                    <Video className="h-12 w-12 text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Video URL Ready</span>
                  </div>
                )}
                {!selectedFile && !videoUrl && (
                    <div className="text-muted-foreground">No media selected</div>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleUpload} disabled={uploading || (!selectedFile && !videoUrl)}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" /> Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoUpload;