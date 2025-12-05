
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useFirebase } from '@/firebase';
import { collection, doc, setDoc, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Motorcycle } from '@/lib/types';
import { PlusCircle, Edit, Trash2, Star, LoaderCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


const motorcycleSchema = z.object({
  name: z.string().optional(),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.coerce.number().min(1900, 'Invalid year').max(new Date().getFullYear() + 1, 'Invalid year'),
  mileage: z.coerce.number().nonnegative('Mileage must be positive').optional(),
  isDefault: z.boolean().default(false),
});

type MotorcycleFormData = z.infer<typeof motorcycleSchema>;

interface MotorcycleFormProps {
  userId: string;
  motorcycle?: Motorcycle;
  motorcycles: Motorcycle[];
  onSave: () => void;
}

const MotorcycleForm = ({ userId, motorcycle, motorcycles, onSave }: MotorcycleFormProps) => {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { register, handleSubmit, control, formState: { errors } } = useForm<MotorcycleFormData>({
        resolver: zodResolver(motorcycleSchema),
        defaultValues: motorcycle || { isDefault: false, make: '', model: '', year: new Date().getFullYear() },
    });

    const onSubmit = async (data: MotorcycleFormData) => {
        if (!firestore) return;
        setIsSubmitting(true);

        const batch = writeBatch(firestore);
        
        const newMotorcycleData = {
            ...data,
            userId,
        };

        // If this is the new default, unset the old default
        if (data.isDefault) {
            const oldDefault = motorcycles.find(m => m.isDefault && m.id !== motorcycle?.id);
            if (oldDefault) {
                const oldDefaultRef = doc(firestore, 'users', userId, 'motorcycles', oldDefault.id);
                batch.update(oldDefaultRef, { isDefault: false });
            }
        }
        
        try {
            if (motorcycle) { // Editing existing
                const motorcycleRef = doc(firestore, 'users', userId, 'motorcycles', motorcycle.id);
                batch.set(motorcycleRef, newMotorcycleData, { merge: true });
                await batch.commit();

                toast({ title: 'Motorcycle Updated' });
            } else { // Adding new
                const collectionRef = collection(firestore, 'users', userId, 'motorcycles');
                // Since we need the ID for batching, we create one client-side
                const newMotorcycleRef = doc(collectionRef);
                batch.set(newMotorcycleRef, newMotorcycleData);
                await batch.commit();
                
                toast({ title: 'Motorcycle Added' });
            }
            onSave();
        } catch (error: any) {
            console.error(error);
             const path = motorcycle ? `users/${userId}/motorcycles/${motorcycle.id}` : `users/${userId}/motorcycles`;
            const operation = motorcycle ? 'update' : 'create';
            
            const permissionError = new FirestorePermissionError({
                path,
                operation,
                requestResourceData: newMotorcycleData,
            });
            errorEmitter.emit('permission-error', permissionError);

            toast({ title: 'An error occurred', description: error.message, variant: 'destructive' });
        } finally {
             setIsSubmitting(false);
        }
    };
    
    return (
         <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="make">Make</Label>
                    <Input id="make" {...register('make')} />
                    {errors.make && <p className="text-sm text-destructive">{errors.make.message}</p>}
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" {...register('model')} />
                    {errors.model && <p className="text-sm text-destructive">{errors.model.message}</p>}
                </div>
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="year">Year</Label>
                    <Input id="year" type="number" {...register('year')} />
                    {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="name">Nickname</Label>
                    <Input id="name" {...register('name')} placeholder="e.g., 'The Beast'" />
                </div>
            </div>
             <div className="flex items-center space-x-2 pt-2">
                <Switch id="isDefault" {...register('isDefault')} />
                <Label htmlFor="isDefault">Set as default motorcycle</Label>
            </div>
            <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                     {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                    Save Motorcycle
                </Button>
            </DialogFooter>
        </form>
    );
};


export function MotorcycleManager({ motorcycles, userId }: { motorcycles: Motorcycle[], userId: string }) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMotorcycle, setEditingMotorcycle] = useState<Motorcycle | undefined>(undefined);
    const { firestore } = useFirebase();
    const { toast } = useToast();


    const openForm = (motorcycle?: Motorcycle) => {
        setEditingMotorcycle(motorcycle);
        setIsFormOpen(true);
    }
    
    const closeForm = () => {
        setEditingMotorcycle(undefined);
        setIsFormOpen(false);
    }

    const handleDelete = (motorcycleId: string) => {
        if (!firestore) return;
        const motorcycleRef = doc(firestore, 'users', userId, 'motorcycles', motorcycleId);
        
        deleteDoc(motorcycleRef)
            .then(() => {
                toast({ title: "Motorcycle removed" });
            })
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: motorcycleRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ title: 'Error removing motorcycle', variant: 'destructive' });
            });
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-headline">Whips</CardTitle>
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                         <Button variant="outline" size="icon" onClick={() => openForm()}>
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingMotorcycle ? 'Edit Motorcycle' : 'Add a New Motorcycle'}</DialogTitle>
                        </DialogHeader>
                        <MotorcycleForm userId={userId} motorcycle={editingMotorcycle} motorcycles={motorcycles} onSave={closeForm} />
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
                {motorcycles.length > 0 ? (
                    motorcycles.map(moto => (
                        <div key={moto.id} className="flex items-center justify-between rounded-md border p-3">
                            <div>
                                <h4 className="font-semibold flex items-center gap-2">
                                    {moto.name || `${moto.make} ${moto.model}`}
                                    {moto.isDefault && <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />}
                                </h4>
                                <p className="text-sm text-muted-foreground">{moto.year} {moto.make}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openForm(moto)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                         <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete this motorcycle from your profile.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(moto.id)}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-4">No motorcycles added yet.</p>
                )}
            </CardContent>
        </Card>
    );
}
