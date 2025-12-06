'use client';

import { useState, useEffect } from 'react';
import { useUserProfile } from '@/hooks/use-user-profile';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, Satellite } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function GpsStatusToggle({ className }: Props) {
  const { firestore } = useFirebase();
  const { user, isUserLoading } = useUserProfile();
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setIsGpsActive(user.gpsActive || false);
    }
  }, [user]);

  const handleGpsToggle = async (gpsActive: boolean) => {
    if (!firestore || !user) return;

    setIsUpdating(true);
    const userRef = doc(firestore, 'users', user.uid);

    // Turning GPS on: get current position and persist coordinates + flag.
    if (gpsActive) {
      if (!navigator.geolocation) {
        toast({
          title: 'Geolocation not supported',
          description: "Your browser doesn't support geolocation.",
          variant: 'destructive',
        });
        setIsUpdating(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            await updateDoc(userRef, { gpsActive: true, latitude, longitude });
            setIsGpsActive(true);
            toast({
              title: 'GPS Enabled',
              description: 'Your location is now being shared.',
            });
          } catch (error) {
            console.error('Error updating GPS status:', error);
            toast({
              title: 'Update Failed',
              description: 'Could not update your GPS status.',
              variant: 'destructive',
            });
          } finally {
            setIsUpdating(false);
          }
        },
        (error) => {
          toast({
            title: 'Geolocation Error',
            description: error.message,
            variant: 'destructive',
          });
          setIsUpdating(false);
        },
        { maximumAge: 0 }
      );
      return;
    }

    // Turning GPS off: clear coordinates and flag.
    try {
      await updateDoc(userRef, { gpsActive: false, latitude: null, longitude: null });
      setIsGpsActive(false);
      toast({
        title: 'GPS Disabled',
        description: 'Your location is no longer being shared.',
      });
    } catch (error) {
      console.error('Error updating GPS status:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update your GPS status.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className={cn(baseHudClass, className)}>
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Syncing GPS…
        </div>
      </div>
    );
  }

  return (
    <div className={cn(baseHudClass, className)}>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/40">
          <Satellite className="h-3 w-3 text-primary" />
        </div>
        <div className="leading-tight">
          <div className="text-[9px] uppercase tracking-[0.18em] text-primary/80">
            GPS
          </div>
          <div className="text-[11px] font-semibold text-foreground">
            {isGpsActive ? 'On' : 'Off'}
          </div>
        </div>
      </div>
      {isUpdating ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : (
        <Switch
          id="gps-toggle"
          checked={isGpsActive}
          onCheckedChange={handleGpsToggle}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
        />
      )}
    </div>
  );
}

const baseHudClass =
  'group relative flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-800/80 px-2.5 py-2 text-sm shadow-lg shadow-primary/10 ring-1 ring-primary/20 backdrop-blur';
