'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { UserProfile, Motorcycle } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateRandomAvatarPlaceholder } from "@/lib/avatar";
import { Pencil, Bike } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ProfileImageManager } from "./profile-image-manager";
import { DialogTrigger } from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';

interface ProfileHeaderProps {
    profile: UserProfile;
    motorcycles: Motorcycle[];
    fullName: string;
    onImageCropped: (dataUrl: string) => void;
    onImageDelete: () => void;
}

export const ProfileHeader = ({ profile, motorcycles, fullName, onImageCropped, onImageDelete }: ProfileHeaderProps) => {
    const defaultMotorcycle = motorcycles.find(m => m.isDefault) || motorcycles[0];
    const avatarUrl = profile.profilePicture || generateRandomAvatarPlaceholder(profile.id);
    const fallbackName = `${profile?.firstName?.charAt(0) || ''}${profile?.lastName?.charAt(0) || ''}`;
    const hasClubInfo = profile.clubName || profile.clubChapter || profile.rank;


    return (
        <Card className="overflow-hidden bg-gradient-to-br from-slate-900 to-gray-800 text-white shadow-xl">
            <div className="p-6">
                <div className="flex items-start gap-6">
                    {/* Avatar */}
                    <ProfileImageManager onImageCropped={onImageCropped} currentImageUrl={profile.profilePicture}>
                        <DialogTrigger asChild>
                             <div className="relative group cursor-pointer shrink-0">
                                <Avatar className="h-28 w-28 border-4 border-burnt-orange shadow-lg">
                                    <AvatarImage src={avatarUrl} alt="Profile preview" />
                                    <AvatarFallback className="text-4xl font-bold bg-burnt-orange text-white">{fallbackName}</AvatarFallback>
                                </Avatar>
                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <Pencil className="h-8 w-8 text-white" />
                                </div>
                            </div>
                        </DialogTrigger>
                    </ProfileImageManager>

                    {/* Name and Riding Info */}
                    <div className="flex flex-col gap-1 pt-2">
                        <h1 className="font-headline text-3xl font-bold text-gray-100 tracking-wide">
                            {fullName}
                        </h1>
                        {profile.roadName && (
                             <p className="text-2xl font-bold text-burnt-orange">
                                {profile.roadName}
                            </p>
                        )}
                         {defaultMotorcycle && (
                            <div className="flex items-center text-sm text-gray-300 mt-1">
                                <Bike className="h-4 w-4 mr-2" /> 
                                <span className='italic'>Riding: {defaultMotorcycle.name || `${defaultMotorcycle.year} ${defaultMotorcycle.make} ${defaultMotorcycle.model}`}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {(hasClubInfo) && (
                <>
                    <Separator className="bg-gray-700" />
                    <div className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-burnt-orange">Rank</p>
                                <p className="mt-1 text-sm font-medium text-gray-200">{profile.rank || '-'}</p>
                            </div>
                            <div className="border-l border-r border-gray-700 px-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-burnt-orange">Club</p>
                                <p className="mt-1 text-sm font-medium text-gray-200">{profile.clubName || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-burnt-orange">Chapter</p>
                                <p className="mt-1 text-sm font-medium text-gray-200">{profile.clubChapter || '-'}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
            
            <Separator className="bg-gray-700"/>

            <div className="px-6 py-3 bg-gray-900/30">
                 <p className="text-sm text-gray-400">@{profile.userName}</p>
            </div>
        </Card>
    );
};
