
'use client';

import { useState, useEffect } from 'react';
import { EventCalendar } from './components/event-calendar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UpcomingRides } from './components/upcoming-rides';
import { Skeleton } from '@/components/ui/skeleton';

export default function SchedulerPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
            My Schedule
          </h1>
          <p className="text-muted-foreground">
            View your calendar and share open slots with friends.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/scheduler/requests">View My Requests</Link>
        </Button>
      </header>
      <main className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {isClient ? (
          <>
            <div className="lg:col-span-2">
              <EventCalendar />
            </div>
            <div className="lg:col-span-1">
              <UpcomingRides />
            </div>
          </>
        ) : (
          <>
            <div className="lg:col-span-2">
              <Skeleton className="h-[400px] w-full" />
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-[400px] w-full" />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
