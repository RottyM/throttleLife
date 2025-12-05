
'use client';
import { useState, useMemo } from 'react';
import { useCollection, useFirebase, useUser } from '@/firebase';
import { collection, query, where, doc, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageCircle, Bell, ChevronDown, Bike, Database, LogIn, MapPin, LoaderCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useMemoFirebase } from '@/firebase';


// Define the shape of a user profile, mirroring docs/backend.json
interface UserProfile {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  aboutMe?: string;
  clubName?: string;
  rank?: string;
  contactInfo?: string;
  emergencyContact?: string;
  gpsActive?: boolean;
  latitude?: number;
  longitude?: number;
}

interface Motorcycle {
    id: string;
    userId: string;
    make: string;
    model: string;
    year: number;
    name?: string;
    mileage?: number;
    isDefault?: boolean;
}

const MemberCardSkeleton = () => (
  <Card>
    <CardHeader className="flex flex-row items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </CardHeader>
    <CardContent>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full mt-2" />
    </CardContent>
    <CardFooter className="flex justify-end gap-2">
      <Skeleton className="h-10 w-24" />
      <Skeleton className="h-10 w-24" />
    </CardFooter>
  </Card>
)

const MemberCard = ({ member }: { member: UserProfile }) => {
    const { toast } = useToast();
    const [isNotifying, setIsNotifying] = useState(false);

    return (
        <Collapsible asChild>
            <Card>
                <CardHeader className="flex flex-row items-start gap-4">
                    <Avatar className="h-12 w-12">
                        {member.profilePicture ? (
                            <AvatarImage src={member.profilePicture} alt={member.userName} />
                        ) : (
                            <AvatarFallback>
                                {member.firstName?.charAt(0)}
                                {member.lastName?.charAt(0)}
                            </AvatarFallback>
                        )}
                    </Avatar>
                    <div className='flex-1'>
                        <CardTitle className="font-headline text-lg">
                            {member.firstName} {member.lastName}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                            @{member.userName}
                        </p>
                    </div>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-9 p-0">
                            <ChevronDown className="h-4 w-4" />
                            <span className="sr-only">Toggle</span>
                        </Button>
                    </CollapsibleTrigger>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className='space-y-2'>
                        {member.clubName && <p className="text-sm"><span className="font-semibold">Club:</span> {member.clubName}</p>}
                        {member.rank && <p className="text-sm"><span className="font-semibold">Rank:</span> {member.rank}</p>}
                    </div>
                    <CollapsibleContent className="space-y-4">
                        <Separator />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center space-x-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <Label htmlFor={`gps-active-${member.id}`} className="text-sm">
                                        GPS Active
                                    </Label>
                                </div>
                                <Switch
                                    id={`gps-active-${member.id}`}
                                    checked={!!member.gpsActive}
                                    disabled
                                    aria-label="GPS status"
                                />
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            <h4 className="font-semibold">Contact</h4>
                            <p className="text-sm text-muted-foreground">{member.contactInfo || 'No contact info'}</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold">Emergency Contact</h4>
                            <p className="text-sm text-muted-foreground">{member.emergencyContact || 'No emergency contact'}</p>
                        </div>
                    </CollapsibleContent>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/chat?userId=${member.id}`}>
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Chat
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </Collapsible>
    );
};


export default function MembersPage() {
  const { firestore, user: currentUser } = useFirebase();
  const { isUserLoading } = useUser();

  const membersQuery = useMemoFirebase(
    () => (firestore && currentUser ? query(collection(firestore, 'users')) : null),
    [firestore, currentUser]
  );

  const {
    data: members,
    isLoading: isMembersLoading,
    error,
  } = useCollection<UserProfile>(membersQuery);

  const otherMembers = members?.filter(member => member.id !== currentUser?.uid);
  const isLoading = isUserLoading || isMembersLoading;

   if (!isUserLoading && !currentUser) {
    return (
      <div className="flex-1 p-4 md:p-8 flex items-center justify-center">
         <Card className="mt-8">
              <CardContent className="p-8 text-center">
                  <h3 className="font-headline text-xl">Access Denied</h3>
                  <p className="text-muted-foreground mt-2 mb-4">
                      You need to be logged in to view this page.
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

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
            Members
          </h1>
          <p className="text-muted-foreground">
            Connect with other motorcycle enthusiasts.
          </p>
        </div>
      </header>
      <main>
        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <MemberCardSkeleton key={i} />
            ))}
          </div>
        )}
        {error && <p className="text-destructive">Error: {error.message}</p>}
        {!isLoading && !error && !otherMembers?.length && (
           <Card className="mt-8">
                <CardContent className="p-8 text-center">
                    <h3 className="font-headline text-xl">No Members Found</h3>
                    <p className="text-muted-foreground mt-2">
                        It looks like you're the first one here!
                    </p>
                </CardContent>
            </Card>
        )}
        {!isLoading && !error && otherMembers && otherMembers.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {otherMembers?.map((member) => (
                <MemberCard key={member.id} member={member} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
