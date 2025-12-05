
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface AvatarSelectionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAvatarSelect: (url: string) => void;
}

const generateAvatars = (count: number, offset = 0) => {
  return Array.from({ length: count }, (_, i) => ({
    id: offset + i,
    // Using a combination of index and a random number for better uniqueness on "load more"
    url: `https://i.pravatar.cc/150?u=${Math.random().toString(36).substring(7)}${offset + i}`,
  }));
};

export function AvatarSelectionDialog({
  isOpen,
  onOpenChange,
  onAvatarSelect,
}: AvatarSelectionDialogProps) {
  const [avatars, setAvatars] = useState(() => generateAvatars(12));

  const handleSelect = (url: string) => {
    onAvatarSelect(url);
    toast({
      title: "Avatar Selected",
      description: "Your profile image has been updated.",
    });
    onOpenChange(false);
  };

  const loadMoreAvatars = () => {
    const newAvatars = generateAvatars(12, avatars.length);
    setAvatars(prevAvatars => [...prevAvatars, ...newAvatars]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose an Avatar</DialogTitle>
          <DialogDescription>
            Select one of the randomly generated avatars below. Clicking an avatar will immediately update your profile picture.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 w-full p-4">
          <div className="grid grid-cols-3 gap-4">
            {avatars.map((avatar) => (
              <div
                key={avatar.id}
                className="group relative cursor-pointer aspect-square overflow-hidden rounded-full transition-transform hover:scale-105"
                onClick={() => handleSelect(avatar.url)}
              >
                <Image
                  src={avatar.url}
                  alt={`Avatar ${avatar.id + 1}`}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-white font-bold">Select</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={loadMoreAvatars}>
            Load More Variations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
