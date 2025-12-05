'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useStorage } from '@/firebase';
import { collection, query, where, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { Camera, LoaderCircle, CheckCircle, FileImage, ExternalLink } from 'lucide-react';
import type { Motorcycle, MileageLog } from '@/lib/types';
import Link from 'next/link';
import { useMemoFirebase } from '@/firebase';

const mileageSchema = z.object({
  motorcycleId: z.string().min(1, 'Please select a motorcycle'),
  mileage: z.coerce.number().positive('Mileage must be a positive number'),
  photo: z.any().refine((files) => files?.length === 1, 'Photo is required.'),
  type: z.enum(['start_of_year', 'end_of_year']),
});

type MileageFormData = z.infer<typeof mileageSchema>;

const MileageLogCard = ({ log, motorcycleName }: { log: MileageLog, motorcycleName: string }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{motorcycleName}</CardTitle>
        <CardDescription>
          {log.type === 'start_of_year' ? 'Start of Year' : 'End of Year'} Entry for {log.year}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
         <div>
            <p className="text-3xl font-bold text-center">{log.mileage.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground text-center">Miles</p>
        </div>
        <p className="text-xs text-muted-foreground text-center">Logged on: {new Date(log.timestamp).toLocaleDateString()}</p>
      </CardContent>
      <CardFooter>
          <Button asChild variant="outline" className="w-full">
              <Link href={log.photoUrl} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Proof
              </Link>
          </Button>
      </CardFooter>
    </Card>
  );
};


export default function MileageChallengePage() {
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const storage = useStorage();
  const [isLoading, setIsLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const challengeYear = 2026;
  const isEndOfYear = new Date().getMonth() > 5; // Simple check if it's past June

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MileageFormData>({
    resolver: zodResolver(mileageSchema),
    defaultValues: {
      type: isEndOfYear ? 'end_of_year' : 'start_of_year',
    },
  });
  
  const motorcyclesQuery = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'users', user.uid, 'motorcycles') : null),
    [firestore, user]
  );
  const { data: motorcycles, isLoading: motorcyclesLoading } = useCollection<Motorcycle>(motorcyclesQuery);


  const mileageLogsQuery = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'users', user.uid, 'mileageLogs'),
            where('year', '==', challengeYear)
          )
        : null,
    [firestore, user, challengeYear]
  );
  
  const { data: mileageLogs, isLoading: logsLoading } = useCollection<MileageLog>(mileageLogsQuery);

  const startOfYearLog = mileageLogs?.find(log => log.type === 'start_of_year');
  const endOfYearLog = mileageLogs?.find(log => log.type === 'end_of_year');


  const onSubmit = async (data: MileageFormData) => {
    if (!firestore || !user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to submit.',
        variant: 'destructive',
      });
      return;
    }
    setIsLoading(true);

    try {
      const file = data.photo[0];
      const storageRef = ref(
        storage,
        `mileage-proof/${user.uid}/${challengeYear}_${data.type}_${file.name}`
      );

      const snapshot = await uploadBytes(storageRef, file);
      const photoUrl = await getDownloadURL(snapshot.ref);

      const logData = {
        userId: user.uid,
        motorcycleId: data.motorcycleId,
        mileage: data.mileage,
        photoUrl: photoUrl,
        timestamp: new Date().toISOString(),
        type: data.type,
        year: challengeYear,
      };

      await addDoc(
        collection(firestore, 'users', user.uid, 'mileageLogs'),
        logData
      );

      toast({
        title: 'Success!',
        description: 'Your mileage has been logged.',
      });
      reset();
      setPhotoPreview(null);
    } catch (error: any) {
      console.error('Error submitting mileage log:', error);
      toast({
        title: 'Uh oh!',
        description: error.message || 'Could not submit your mileage log.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const photoFile = watch('photo');

  const getMotorcycleName = (motoId: string) => {
    const moto = motorcycles?.find(m => m.id === motoId);
    if (!moto) return 'Motorcycle';
    return moto.name || `${moto.year} ${moto.make} ${moto.model}`;
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <header>
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
          Mileage Challenge {challengeYear}
        </h1>
        <p className="text-muted-foreground">
          Log your mileage and see how far you've gone this year.
        </p>
      </header>
      <main className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submit Your Mileage</CardTitle>
            <CardDescription>
              Submit your {isEndOfYear ? 'end-of-year' : 'start-of-year'} mileage reading.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label>Motorcycle</Label>
                <Controller
                  name="motorcycleId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your bike" />
                      </SelectTrigger>
                      <SelectContent>
                        {motorcyclesLoading && <SelectItem value="loading" disabled>Loading bikes...</SelectItem>}
                        {motorcycles?.map((moto) => (
                          <SelectItem key={moto.id} value={moto.id}>
                            {moto.name || `${moto.year} ${moto.make} ${moto.model}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.motorcycleId && (
                  <p className="text-sm text-destructive">{errors.motorcycleId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mileage">Odometer Reading (Miles)</Label>
                <Input
                  id="mileage"
                  type="number"
                  {...register('mileage')}
                  placeholder="e.g., 12345"
                />
                {errors.mileage && (
                  <p className="text-sm text-destructive">{errors.mileage.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Proof of Mileage</Label>
                 <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  {...register('photo', {
                    onChange: (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setPhotoPreview(file.name);
                      }
                    }
                  })}
                />
                <Label htmlFor="photo" className="cursor-pointer">
                  <Card className="hover:bg-muted/50">
                    <CardContent className="flex h-full flex-col items-center justify-center space-y-2 p-6 text-muted-foreground">
                       {photoPreview ? (
                        <div className='text-center text-foreground'>
                          <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
                          <p className='mt-2 font-semibold'>Photo Selected</p>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">{photoPreview}</p>
                           <span className="mt-2 text-sm font-light text-blue-500 hover:underline">Change photo</span>
                        </div>
                      ) : (
                        <>
                          <Camera className="h-10 w-10" />
                          <p>Upload a photo of your odometer</p>
                        </>
                       )}
                    </CardContent>
                  </Card>
                </Label>
                {errors.photo && (
                  <p className="text-sm text-destructive">{errors.photo.message as string}</p>
                )}
              </div>
              
              <input type="hidden" {...register('type')} />

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Submit {isEndOfYear ? 'End-of-Year' : 'Start-of-Year'} Mileage
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="space-y-8">
            {logsLoading && <p>Loading logs...</p>}
            {startOfYearLog && (
                <MileageLogCard log={startOfYearLog} motorcycleName={getMotorcycleName(startOfYearLog.motorcycleId)} />
            )}
            {endOfYearLog && (
                <MileageLogCard log={endOfYearLog} motorcycleName={getMotorcycleName(endOfYearLog.motorcycleId)} />
            )}
            {startOfYearLog && endOfYearLog && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Yearly Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold text-center">
                            {(endOfYearLog.mileage - startOfYearLog.mileage).toLocaleString()}
                        </p>
                         <p className="text-sm text-muted-foreground text-center">Miles Ridden</p>
                    </CardContent>
                </Card>
            )}
            {!logsLoading && !startOfYearLog && !endOfYearLog && (
                <Card className='flex h-full items-center justify-center'>
                    <CardContent className='p-8 text-center'>
                        <p className='text-muted-foreground'>No mileage logged for {challengeYear} yet.</p>
                    </CardContent>
                </Card>
            )}
        </div>
      </main>
    </div>
  );
}
