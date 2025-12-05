"use client";

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Area, Point } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { AvatarSelectionDialog } from "./AvatarSelectionDialog"; // Import the new component

interface ProfileImageManagerProps {
  onImageCropped: (dataUrl: string) => void;
  currentImageUrl?: string | null;
  children?: React.ReactNode; // Add children prop
}

// Helper to get a cropped image from a data URL
const getCroppedImg = (imageSrc: string, pixelCrop: Area): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('No 2d context'));
      }

      const { width, height, x, y } = pixelCrop;

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(
        image,
        x,
        y,
        width,
        height,
        0,
        0,
        width,
        height
      );

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(dataUrl);
    };
    image.onerror = (error) => reject(error);
  });
};

export function ProfileImageManager({ onImageCropped, currentImageUrl, children }: ProfileImageManagerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false); // State for the new dialog

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setIsOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropImage = useCallback(async () => {
    try {
      if (image && croppedAreaPixels) {
        const croppedImage = await getCroppedImg(image, croppedAreaPixels);
        onImageCropped(croppedImage);
        toast({
          title: "Image cropped successfully!",
          description: "Your profile image has been updated.",
        });
        setIsOpen(false);
        setImage(null); // Clear the image state after cropping
      }
    } catch (e) {
      console.error(e);
      toast({
        title: "Error cropping image",
        description: "There was an error while cropping your image. Please try again.",
        variant: "destructive",
      });
    }
  }, [image, croppedAreaPixels, onImageCropped]);

  const handleAvatarSelected = (url: string) => {
    onImageCropped(url); // Pass the selected URL directly
    setIsAvatarDialogOpen(false); // Close the avatar dialog
    setIsOpen(false); // Close the main dialog
  };
  
  // Reset image state when main dialog is closed
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setImage(null);
    }
    setIsOpen(open);
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {children || (
            <Button variant="outline">
              {currentImageUrl ? "Change Profile Image" : "Upload Profile Image"}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentImageUrl ? "Change Profile Image" : "Upload Profile Image"}</DialogTitle>
            <DialogDescription>
              Upload a new photo, or choose from our gallery of avatars.
            </DialogDescription>
          </DialogHeader>
          {!image ? (
            <div className="grid gap-4 py-4">
              <p className="text-sm text-muted-foreground">
                Upload a new photo or choose from our gallery of avatars.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Label htmlFor="picture" className="w-full">
                  <div className="flex items-center justify-center w-full h-full p-4 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted">
                    Upload Photo
                  </div>
                   <Input id="picture" type="file" onChange={handleFileChange} accept="image/*" className="hidden" />
                </Label>
                <Button variant="outline" onClick={() => setIsAvatarDialogOpen(true)}>Choose an Avatar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative w-full h-64 bg-gray-200">
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  aspect={1} // For a square profile picture
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div className="flex justify-between items-center">
                <Label htmlFor="zoom">Zoom</Label>
                <Input
                  id="zoom"
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-3/4"
                />
              </div>
              <Button onClick={handleCropImage} className="w-full">Crop Image</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AvatarSelectionDialog 
        isOpen={isAvatarDialogOpen} 
        onOpenChange={setIsAvatarDialogOpen}
        onAvatarSelect={handleAvatarSelected}
      />
    </>
  );
}