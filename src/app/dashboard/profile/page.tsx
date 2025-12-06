'use client';

import { useState, useEffect } from 'react';
import { useUser, useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, collection, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import type { UserProfile, Motorcycle } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, LogIn, LoaderCircle, UserPlus } from 'lucide-react';
import { ProfileHeader } from './components/profile-header';
import { ProfileView } from './components/profile-view';
import { EditProfileForm } from './components/edit-profile-form';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { MotorcycleManager } from './components/motorcycle-manager';
import { GpsStatusCard } from './components/gps-status-card'; // Import the new component

const ProfilePageSkeleton = () => (
    <div className="flex-1 space-y-4 p-4 md:p-8">
        <div className="flex items-center justify-between">
            <div className="space-y-2">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-6 w-72" />
            </div>
            <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
                <Card>
                    <CardHeader className="items-center p-8 text-center flex-col">
                        <Skeleton className="h-24 w-24 rounded-full" />
                        <Skeleton className="mt-4 h-8 w-1/2" />
                        <Skeleton className="mt-2 h-6 w-1/4" />
                    </CardHeader>
                </Card>
                <Card>
                     <CardContent className="p-8">
                         <Skeleton className="h-6 w-1/4 mb-4" />
                         <Skeleton className="h-24 w-full" />
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-8">
                 <Card>
                     <CardHeader>
                         <Skeleton className="h-8 w-1/2" />
                     </CardHeader>
                     <CardContent className="p-6">
                         <Skeleton className="h-12 w-full mb-2" />
                         <Skeleton className="h-12 w-full" />
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
);

function ProfileData() {
  const { firestore, user, storage } = useFirebase();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user?.uid]
  );
  const motorcyclesRef = useMemoFirebase(
    () => (firestore && user?.uid ? collection(firestore, 'users', user.uid, 'motorcycles') : null),
    [firestore, user?.uid]
  );

  const { data: profile, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userProfileRef);
  const { data: motorcycles, isLoading: areMotorcyclesLoading } = useCollection<Motorcycle>(motorcyclesRef);

  const isLoading = isProfileLoading || areMotorcyclesLoading;

  const isProfileIncomplete = profile && (!profile.firstName || !profile.lastName || !profile.userName);
  const isProfileMissing = !profile;

  const [isEditMode, setIsEditMode] = useState(isProfileMissing || isProfileIncomplete);
  const [isGpsLoading, setIsGpsLoading] = useState(false); // State for GPS toggle loading

  useEffect(() => {
    if (profileError instanceof FirestorePermissionError) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to access this profile. Please ensure you are logged in correctly.",
        variant: "destructive",
      });
    }
  }, [profileError, toast]);

  useEffect(() => {
    if (!isLoading) {
      setIsEditMode(isProfileMissing || isProfileIncomplete);
    }
  }, [profile, isProfileMissing, isProfileIncomplete, isLoading]);

  const handleProfileImageCropped = async (imageString: string) => {
    if (!firestore || !user || !storage) return;

    const profileRef = doc(firestore, 'users', user.uid);

    // If it's a regular URL from our avatar selection, save it directly
    if (imageString.startsWith('https://')) {
      try {
        await setDoc(profileRef, { profilePicture: imageString }, { merge: true });
        toast({
          title: "Profile Image Updated",
          description: "Your new avatar has been saved.",
        });
      } catch (error: any) {
        console.error("Error updating profile picture with avatar:", error);
        toast({
          title: "Update Failed",
          description: error.message || 'Could not save your new avatar.',
          variant: "destructive",
        });
      }
      return;
    }

    // If it's a data URL (base64), upload it to Firebase Storage
    if (imageString.startsWith('data:')) {
      const storageRef = ref(storage, `profile_images/${user.uid}`);
      toast({
        title: "Uploading Image...",
        description: "Please wait while we upload your new profile picture.",
      });

      try {
        // Upload the image
        const uploadResult = await uploadString(storageRef, imageString, 'data_url');
        
        // Get the download URL
        const downloadURL = await getDownloadURL(uploadResult.ref);

        // Save the download URL to Firestore
        await setDoc(profileRef, { profilePicture: downloadURL }, { merge: true });
        
        toast({
          title: "Profile Image Updated",
          description: "Your profile picture has been saved.",
        });
      } catch (error: any) {
        console.error("Error uploading profile picture:", error);
        toast({
          title: "Upload Failed",
          description: error.message || 'Could not upload your profile picture.',
          variant: "destructive",
        });
      }
    }
  };

  const handleProfileImageDelete = async () => {
    if (!firestore || !user) return;
    try {
      const profileRef = doc(firestore, 'users', user.uid);
      await setDoc(profileRef, { profilePicture: "" }, { merge: true }); // Set profilePicture to empty string
      toast({
        title: "Profile Image Removed",
        description: "Your profile picture has been removed.",
      });
    } catch (error: any) {
      console.error("Error deleting profile picture:", error);
      toast({
        title: "Removal Failed",
        description: error.message || 'Could not remove your profile picture.',
        variant: "destructive",
      });
    }
  };

  const handleToggleGps = () => {
    if (!firestore || !user || !profile) return;
    const profileRef = doc(firestore, 'users', user.uid);
    const newGpsStatus = !profile.gpsActive;

    setIsGpsLoading(true);

    if (newGpsStatus) {
      // Activating GPS
      if (!navigator.geolocation) {
        toast({
          title: "Geolocation not supported",
          description: "Your browser doesn't support geolocation.",
          variant: "destructive",
        });
        setIsGpsLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await updateDoc(profileRef, {
              gpsActive: true,
              latitude,
              longitude,
            });
            toast({
              title: "GPS Activated",
              description: "Your location is now being shared.",
            });
          } catch (error: any) {
             toast({ title: "Error updating location", description: error.message, variant: "destructive" });
          } finally {
            setIsGpsLoading(false);
          }
        },
        (error) => {
          toast({
            title: "Geolocation Error",
            description: error.message,
            variant: "destructive",
          });
          setIsGpsLoading(false);
        },
        {
            maximumAge: 0,
        }
      );
    } else {
      // Deactivating GPS
      updateDoc(profileRef, {
        gpsActive: false,
        latitude: null,
        longitude: null,
      })
      .then(() => {
        toast({
          title: "GPS Deactivated",
          description: "Your location is no longer being shared.",
        });
      })
      .catch((error: any) => {
        toast({ title: "Error updating GPS status", description: error.message, variant: "destructive" });
      })
      .finally(() => {
        setIsGpsLoading(false);
      });
    }
  };

  if (isLoading) {
    return <ProfilePageSkeleton />;
  }
  
  const fullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.userName || '';

  let headerDescription = 'Your personal corner of ThrottleLife.';
  if (isEditMode) {
    if (isProfileMissing) {
      headerDescription = "It looks like you don't have a profile yet. Let's create one!";
    } else if (isProfileIncomplete) {
      headerDescription = 'Your profile is incomplete. Please fill out the required fields.';
    } else {
      headerDescription = 'Update your personal details.';
    }
  }

  let formInitialData: UserProfile | undefined = profile || undefined;
  if (isProfileMissing && user) {
      const [firstName = '', lastName = ''] = user.displayName?.split(' ') || ['', ''];
      formInitialData = {
          id: user.uid,
          email: user.email || '',
          userName: user.email?.split('@')[0] || `user_${user.uid.substring(0, 5)}`,
          firstName: firstName,
          lastName: lastName,
          profilePicture: '',
          clubColors: {
              primary: "24.6 95% 53.1%", // Default color
              enabled: false,
          },
      };
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
            {isEditMode ? 'Edit Profile' : 'My Profile'}
          </h1>
          <p className="text-muted-foreground">
            {headerDescription}
          </p>
        </div>
        <div className="flex items-center gap-2">
            {!isEditMode && (
                <Button onClick={() => setIsEditMode(true)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Profile
                </Button>
            )}
        </div>
      </header>

      {isEditMode ? (
        <main className="grid gap-8 lg:grid-cols-3">
             <div className="space-y-8 lg:col-span-2">
                <EditProfileForm onSave={() => setIsEditMode(false)} initialData={formInitialData} />
            </div>
             <div className="space-y-8">
                 <MotorcycleManager motorcycles={motorcycles || []} userId={user!.uid} />
            </div>
        </main>
      ) : (
         <main className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-8 lg:col-span-2">
                <ProfileHeader 
                    profile={profile!}
                    motorcycles={motorcycles || []}
                    fullName={fullName}
                    onImageCropped={handleProfileImageCropped}
                    onImageDelete={handleProfileImageDelete}
                />
                <ProfileView profile={profile!} />
            </div>
             <div className="space-y-8">
                <GpsStatusCard 
                    isGpsActive={profile?.gpsActive || false}
                    onToggleGps={handleToggleGps}
                    isLoading={isGpsLoading}
                />
                <MotorcycleManager motorcycles={motorcycles || []} userId={user!.uid} />
            </div>
        </main>
      )}
    </div>
  );
}


export default function ProfilePage() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return <ProfilePageSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 md:p-8">
        <Card className="mt-8">
          <CardContent className="p-8 text-center">
            <h3 className="font-headline text-xl">Access Denied</h3>
            <p className="mt-2 mb-4 text-muted-foreground">
              You need to be logged in to view your profile.
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

  return <ProfileData />;
}