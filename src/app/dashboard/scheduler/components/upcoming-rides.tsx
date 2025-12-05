
'use client';

import * as React from 'react';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { TimeSlotRequest, UserProfile } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO, isFuture } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useMemoFirebase } from '@/firebase';

const UpcomingRideSkeleton = () => (
    <Card>
        <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
            <Skeleton className="h-24 w-full" />
        </CardContent>
        <CardFooter>
            <Skeleton className="h-8 w-full" />
        </CardFooter>
    </Card>
)

const geocodeAddress = async (address: string, apiKey: string) => {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`);
    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
        return data.results[0].geometry.location; // { lat, lng }
    }
    return null;
}


const RideMap = ({ request, apiKey }: { request: TimeSlotRequest, apiKey: string }) => {
    const [position, setPosition] = React.useState<{ lat: number; lng: number } | null>(null);

    React.useEffect(() => {
        if (!request.location) return;
        const { street, city, state, zip } = request.location;
        const fullAddress = [street, city, state, zip].filter(Boolean).join(', ');

        if(fullAddress) {
            geocodeAddress(fullAddress, apiKey).then(setPosition);
        }

    }, [request.location, apiKey]);

    if (!position) {
        return <Skeleton className="h-40 w-full" />;
    }

    return (
        <div className="h-40 w-full overflow-hidden rounded-md">
             <GoogleMap
                mapId={'a7f473062c274ales'}
                defaultCenter={position}
                defaultZoom={13}
                gestureHandling={'greedy'}
                disableDefaultUI={true}
              >
                <AdvancedMarker position={position} />
            </GoogleMap>
        </div>
    );
};


export function UpcomingRides() {
  const { firestore, user } = useFirebase();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const usersQuery = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'users') : null),
    [firestore, user]
  );
  const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);

  const upcomingRequestsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'timeSlotRequests'),
            where('requestedUserIds', 'array-contains', user.uid),
            orderBy('startTime', 'asc')
          )
        : null,
    [firestore, user]
  );
  const { data: requests, isLoading: requestsLoading } = useCollection<TimeSlotRequest>(upcomingRequestsQuery);

  const usersMap = React.useMemo(() => {
    const map = new Map<string, UserProfile>();
    users?.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);
  
  const upcomingRides = React.useMemo(() => {
    if (!requests || !user) return [];
    return requests.filter(req => 
        req.participantStatus[user.uid] === 'Approved' && isFuture(parseISO(req.startTime))
    );
  }, [requests, user]);


  const isLoading = usersLoading || requestsLoading;

  return (
     <Card>
      <CardHeader>
        <CardTitle className="font-headline">Upcoming Rides</CardTitle>
        <CardDescription>Your next adventures on two wheels.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <UpcomingRideSkeleton />}
        {!isLoading && upcomingRides.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
                No upcoming rides scheduled.
            </p>
        )}
        {!isLoading && upcomingRides.map(request => (
            <Card key={request.id} className="bg-muted/50">
                <CardHeader>
                    <CardTitle className="text-base">{request.title}</CardTitle>
                    <CardDescription>{format(parseISO(request.startTime), 'EEE, MMM d, yyyy @ p')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm">{request.purpose}</p>
                    {request.location?.description && (
                         <div className="space-y-2">
                            <p className="text-sm font-semibold">Meetup: {request.location.description}</p>
                            {apiKey && (
                                <APIProvider apiKey={apiKey}>
                                    <RideMap request={request} apiKey={apiKey} />
                                </APIProvider>
                            )}
                         </div>
                    )}
                </CardContent>
                <CardFooter>
                     <div className="flex -space-x-2 overflow-hidden">
                        {request.requestedUserIds.map(userId => {
                             const participant = usersMap.get(userId);
                             if (!participant) return null;
                             return (
                                <TooltipProvider key={userId}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                             <Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                                                <AvatarImage src={participant.profilePicture} />
                                                <AvatarFallback>{participant.firstName?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{participant.firstName} {participant.lastName}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                             )
                        })}
                    </div>
                </CardFooter>
            </Card>
        ))}
      </CardContent>
    </Card>
  );
}
