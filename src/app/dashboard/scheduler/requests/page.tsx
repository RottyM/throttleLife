
'use client';

import * as React from 'react';
import { useFirebase, useCollection, useUser } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import type { TimeSlotRequest, UserProfile } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { useMemoFirebase } from '@/firebase';

const RequestCard = ({
  request,
  users,
  isIncoming,
  currentUser,
}: {
  request: TimeSlotRequest;
  users: Map<string, UserProfile>;
  isIncoming: boolean;
  currentUser: any;
}) => {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const requestor = users.get(request.requestorId);
  const isGroupRequest = request.requestedUserIds.length > 2;

  const handleUpdateStatus = async (status: 'Approved' | 'Rejected') => {
    if (!firestore || !currentUser) return;
    const requestRef = doc(firestore, 'timeSlotRequests', request.id);
    const newStatus = { ...request.participantStatus, [currentUser.uid]: status };
    try {
      await updateDoc(requestRef, { participantStatus: newStatus });
      toast({
        title: `Request ${status}`,
        description: `You have ${status.toLowerCase()} the request.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error updating request',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  const formatAddress = (location: TimeSlotRequest['location']) => {
    if (!location) return 'Not specified';
    const parts = [
      location.street,
      location.city,
      location.state,
      location.zip,
    ];
    return parts.filter(Boolean).join(', ');
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <Avatar>
            <AvatarImage src={requestor?.profilePicture} />
            <AvatarFallback>{requestor?.firstName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{request.title}</CardTitle>
            <CardDescription>
              {format(new Date(request.startTime), 'EEEE, MMMM d, yyyy')}
            </CardDescription>
          </div>
           {isGroupRequest && (
            <Badge variant="secondary" className="ml-auto flex items-center gap-1">
              <Users className="h-3 w-3" /> Group Ride
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 font-semibold">Details</p>
          <p className="text-sm"><span className="text-muted-foreground">From:</span> {requestor?.firstName} {requestor?.lastName}</p>
          <p className="text-sm"><span className="text-muted-foreground">Purpose:</span> {request.purpose}</p>
          {request.location?.description && <p className="text-sm"><span className="text-muted-foreground">Location:</span> {request.location.description}</p>}
          {request.location?.street && <p className="text-sm"><span className="text-muted-foreground">Address:</span> {formatAddress(request.location)}</p>}
        </div>
        <div>
           <p className="mb-2 font-semibold">Participants ({request.requestedUserIds.length})</p>
           <div className="flex flex-wrap gap-2">
            {request.requestedUserIds.map(userId => {
              const user = users.get(userId);
              const status = request.participantStatus[userId];
              return (
                <Badge key={userId} variant={
                  status === 'Approved' ? 'default' : status === 'Rejected' ? 'destructive' : 'secondary'
                }>
                  {user?.firstName} {user?.lastName}
                </Badge>
              )
            })}
           </div>
        </div>
      </CardContent>
       {isIncoming && request.participantStatus[currentUser.uid] === 'Pending' && (
          <CardFooter className="flex gap-2">
            <Button onClick={() => handleUpdateStatus('Approved')}>Approve</Button>
            <Button
              variant="outline"
              onClick={() => handleUpdateStatus('Rejected')}
            >
              Reject
            </Button>
          </CardFooter>
        )}
    </Card>
  );
};

export default function RequestsPage() {
  const { firestore, user } = useFirebase();
  const { isUserLoading } = useUser();

  const usersQuery = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'users') : null),
    [firestore, user]
  );
  const { data: users, isLoading: usersLoading } =
    useCollection<UserProfile>(usersQuery);

  const incomingQuery = useMemoFirebase(
    () =>
      firestore && user?.uid
        ? query(
            collection(firestore, 'timeSlotRequests'),
            where('requestedUserIds', 'array-contains', user.uid)
          )
        : null,
    [firestore, user?.uid]
  );
  const { data: incomingRequests, isLoading: incomingLoading } =
    useCollection<TimeSlotRequest>(incomingQuery);

  const outgoingQuery = useMemoFirebase(
    () =>
      firestore && user?.uid
        ? query(
            collection(firestore, 'timeSlotRequests'),
            where('requestorId', '==', user.uid)
          )
        : null,
    [firestore, user?.uid]
  );
  const { data: outgoingRequests, isLoading: outgoingLoading } =
    useCollection<TimeSlotRequest>(outgoingQuery);

  const usersMap = React.useMemo(() => {
    const map = new Map<string, UserProfile>();
    users?.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);
  
  const isLoading = usersLoading || incomingLoading || outgoingLoading || isUserLoading;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <header>
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
          My Requests
        </h1>
        <p className="text-muted-foreground">
          Manage your incoming and outgoing time slot requests.
        </p>
      </header>
      <main>
        <Tabs defaultValue="incoming">
          <TabsList>
            <TabsTrigger value="incoming">Incoming</TabsTrigger>
            <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
          </TabsList>
          <TabsContent value="incoming" className="mt-4">
            <div className="space-y-4">
              {isLoading && <Skeleton className="h-48 w-full" />}
              {incomingRequests?.map((req) => (
                <RequestCard key={req.id} request={req} users={usersMap} isIncoming={true} currentUser={user}/>
              ))}
              {!isLoading && incomingRequests?.length === 0 && (
                <p className="text-center text-muted-foreground">No incoming requests.</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="outgoing" className="mt-4">
            <div className="space-y-4">
              {isLoading && <Skeleton className="h-48 w-full" />}
              {outgoingRequests?.map((req) => (
                <RequestCard key={req.id} request={req} users={usersMap} isIncoming={false} currentUser={user} />
              ))}
              {!isLoading && outgoingRequests?.length === 0 && (
                <p className="text-center text-muted-foreground">You haven't sent any requests.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
