
'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import type { CalendarEvent, TimeSlotRequest } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isSameDay, format, isBefore, startOfDay, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { RequestSlotDialog } from './request-slot-dialog';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemoFirebase } from '@/firebase';

export function EventCalendar() {
  const { firestore, user } = useFirebase();
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  
  // Fetch approved time slot requests where the user is a participant
  const approvedRequestsQuery = useMemoFirebase(
    () =>
      firestore && user?.uid
        ? query(
            collection(firestore, 'timeSlotRequests'),
            where('requestedUserIds', 'array-contains', user.uid)
          )
        : null,
    [firestore, user?.uid]
  );
  
  const { data: approvedRequests } = useCollection<TimeSlotRequest>(approvedRequestsQuery);

  const events = React.useMemo(() => {
    return approvedRequests
      ?.filter(req => user && req.participantStatus[user.uid] === 'Approved')
      .map(req => ({
        date: parseISO(req.startTime),
        title: req.title,
        duration: `${format(parseISO(req.startTime), 'p')} - ${format(parseISO(req.endTime), 'p')}`
      })) || [];
  }, [approvedRequests, user]);
  

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;

    const isEventDay = events.some((event) => isSameDay(event.date, selectedDate));
    const isPastDay = isBefore(selectedDate, startOfDay(new Date()));

    if (!isEventDay && !isPastDay) {
      setDate(selectedDate);
      setIsDialogOpen(true);
    } else {
      setDate(selectedDate);
    }
  };
  
  const todayEvents = date ? events.filter(e => isSameDay(e.date, date)) : [];
  
  return (
    <>
      <Card>
        <CardContent className="p-2 md:p-6">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            className="rounded-md"
            modifiers={{
              event: events.map((event) => event.date),
              disabled: (d) => isBefore(d, startOfDay(new Date()))
            }}
            modifiersStyles={{
              event: {
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                borderRadius: '9999px'
              },
            }}
          />
        </CardContent>
      </Card>
      
      {date && (
        <RequestSlotDialog
          date={date}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </>
  );
}
