
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useFirebase, useCollection, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { LoaderCircle, ChevronDown } from 'lucide-react';
import { useMemoFirebase } from '@/firebase';

const requestSchema = z.object({
  title: z.string().min(1, 'Please enter a title for the ride'),
  requestedUserIds: z.array(z.string()).min(1, 'Please select at least one member'),
  purpose: z.string().min(3, 'Please provide a reason for the request'),
  location: z.object({
    description: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestSlotDialogProps {
  date: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RequestSlotDialog({
  date,
  open,
  onOpenChange,
}: RequestSlotDialogProps) {
  const formattedDate = format(date, 'EEEE, MMMM d, yyyy');
  const { firestore, user: currentUser } = useFirebase();
  const { toast } = useToast();
  const [isLocationOpen, setIsLocationOpen] = React.useState(false);

  const usersQuery = useMemoFirebase(
    () => (firestore && currentUser ? collection(firestore, 'users') : null),
    [firestore, currentUser]
  );
  const { data: users, isLoading: usersLoading } =
    useCollection<UserProfile>(usersQuery);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      requestedUserIds: [],
    }
  });

  const selectedUserIds = watch('requestedUserIds') || [];

  const handleUserSelect = (userId: string) => {
    const currentIds = selectedUserIds;
    const newIds = currentIds.includes(userId)
      ? currentIds.filter(id => id !== userId)
      : [...currentIds, userId];
    setValue('requestedUserIds', newIds, { shouldValidate: true });
  };


  const onSubmit = async (data: RequestFormData) => {
    if (!firestore || !currentUser) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to send a request.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const requestRef = collection(firestore, 'timeSlotRequests');
      
      const participantStatus = data.requestedUserIds.reduce((acc, id) => {
        acc[id] = 'Pending';
        return acc;
      }, {} as {[key: string]: 'Pending' | 'Approved' | 'Rejected'});
      
      // The requestor is automatically approved
      participantStatus[currentUser.uid] = 'Approved';
      const allParticipantIds = [currentUser.uid, ...data.requestedUserIds];


      const newRequestData = {
        ...data,
        requestorId: currentUser.uid,
        requestedUserIds: allParticipantIds,
        participantStatus,
        startTime: date.toISOString(),
        endTime: date.toISOString(), // Simplified for now
        createdAt: serverTimestamp(),
      };
      
      // First, create the main request document to get its ID
      const requestDocRef = await addDoc(requestRef, newRequestData);

      // Then, create a batch to add all notifications
      const batch = writeBatch(firestore);
      data.requestedUserIds.forEach(userId => {
          const notificationCollection = collection(firestore, `users/${userId}/notifications`);
          const notificationDocRef = doc(notificationCollection); // Create a new doc with a random ID
          batch.set(notificationDocRef, {
            userId: userId,
            type: 'TimeSlotRequest',
            message: `${
              currentUser.displayName || currentUser.email
            } has invited you to: "${data.title}".`,
            relatedEntityId: requestDocRef.id, // Now this is correct
            isRead: false,
            timestamp: serverTimestamp(),
          });
      });
      
      // Commit the batch
      await batch.commit();

      toast({
        title: 'Request Sent!',
        description: `Your ride invitation has been sent.`,
      });
      onOpenChange(false);
      reset();
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error Sending Request',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
   // Reset form when dialog is closed
  React.useEffect(() => {
    if (!open) {
      reset();
      setIsLocationOpen(false);
    }
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-rows-[auto_1fr_auto] flex h-full max-h-[90vh] w-full flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Request Group Ride</DialogTitle>
          <DialogDescription>
            Invite members for a ride on{' '}
            <span className="font-semibold text-foreground">
              {formattedDate}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="pr-6">
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="title">Ride Title</Label>
                <Input
                id="title"
                {...register('title')}
                placeholder="e.g., Coastal Cruise"
                />
                {errors.title && (
                <p className="text-sm text-destructive">
                    {errors.title.message}
                </p>
                )}
            </div>
            
            <div className="space-y-2">
                <Label>Members</Label>
                <ScrollArea className="h-[150px] w-full rounded-md border p-2">
                <div className="space-y-2">
                    {usersLoading && <p>Loading members...</p>}
                    {users
                    ?.filter((user) => user.id !== currentUser?.uid)
                    .map((user) => (
                        <div
                        key={user.id}
                        className="flex items-center space-x-3 rounded-md p-2 hover:bg-muted"
                        onClick={() => handleUserSelect(user.id)}
                        >
                        <Checkbox
                            id={`user-${user.id}`}
                            checked={selectedUserIds.includes(user.id)}
                            onCheckedChange={() => handleUserSelect(user.id)}
                        />
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user.profilePicture} />
                            <AvatarFallback>{user.firstName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <label
                            htmlFor={`user-${user.id}`}
                            className="flex-1 cursor-pointer text-sm font-medium leading-none"
                        >
                            {user.firstName} {user.lastName}
                        </label>
                        </div>
                    ))}
                </div>
                </ScrollArea>
                {errors.requestedUserIds && (
                <p className="text-sm text-destructive">
                    {errors.requestedUserIds.message}
                </p>
                )}
            </div>

            <Collapsible open={isLocationOpen} onOpenChange={setIsLocationOpen}>
                <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex w-full items-center justify-between px-0 hover:bg-transparent">
                    <span className="text-sm font-medium">Location (Optional)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isLocationOpen ? 'rotate-180' : ''}`} />
                </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label htmlFor="location-description">Location Name</Label>
                    <Input
                    id="location-description"
                    {...register('location.description')}
                    placeholder="e.g., Alice's Restaurant"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="location-street">Street Address</Label>
                    <Input
                    id="location-street"
                    {...register('location.street')}
                    placeholder="123 Main St"
                    />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2 col-span-2">
                    <Label htmlFor="location-city">City</Label>
                    <Input
                        id="location-city"
                        {...register('location.city')}
                        placeholder="Anytown"
                    />
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="location-state">State</Label>
                    <Input
                        id="location-state"
                        {...register('location.state')}
                        placeholder="CA"
                    />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="location-zip">Zip Code</Label>
                    <Input
                        id="location-zip"
                        {...register('location.zip')}
                        placeholder="94000"
                    />
                    </div>
                </CollapsibleContent>
            </Collapsible>
            
            <div className="space-y-2">
                <Label htmlFor="purpose">Ride Details / Purpose</Label>
                <Textarea
                id="purpose"
                {...register('purpose')}
                placeholder="e.g., Let's hit the coast and grab lunch."
                />
                {errors.purpose && (
                <p className="text-sm text-destructive">
                    {errors.purpose.message}
                </p>
                )}
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
            <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            )}
            Send Invitations
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
