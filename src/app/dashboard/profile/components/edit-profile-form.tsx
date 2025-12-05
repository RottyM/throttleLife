'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase } from '@/firebase'; // Removed useDoc, useMemoFirebase
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/lib/types';
import { LoaderCircle, X } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

const phoneRegex = new RegExp(
  /^([+]?[\s0-9]+)?(\d{3}|[(]\d{3}[)])?[\s-]?(\d{3})[\s-]?(\d{4})$/
);

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  userName: z.string().min(1, 'Username is required'),
  email: z.string().email('Please enter a valid email address.').min(1, 'Email is required'),
  roadName: z.string().optional(),
  aboutMe: z.string().optional(),
  clubName: z.string().optional(),
  clubChapter: z.string().optional(), // Added Club Chapter
  rank: z.string().optional(),
  contactInfo: z.string().min(1, 'Contact phone is required').regex(phoneRegex, 'Invalid phone number format'),
  emergencyContact: z.string().min(1, 'Emergency contact is required').regex(phoneRegex, 'Invalid phone number format'),
  clubColors: z
    .object({
      primary: z.string().optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface EditProfileFormProps {
  onSave: () => void;
  initialData?: UserProfile; // Make initialData optional
}

// Helper to convert HEX to HSL string
const hexToHsl = (hex: string): string | null => {
  if (!hex) return null;
  if (!hex.startsWith('#')) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
};

const hslToHex = (hslStr: string): string => {
    if (!hslStr) return '#f97316'; // Default color
    const match = hslStr.match(/(\d+\.?\d*)\s*(\d+\.?\d*)%\s*(\d+\.?\d*)%/);
    if (!match) return '#f97316';
  
    let h = parseFloat(match[1]);
    let s = parseFloat(match[2]) / 100;
    let l = parseFloat(match[3]) / 100;
  
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    let m = l - c / 2;
    let r = 0, g = 0, b = 0;
  
    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }
  
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    const toHex = (c: number) => c.toString(16).padStart(2, '0');
  
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const FormSkeleton = () => (
    <Card>
        <CardHeader>
             <Skeleton className="h-8 w-48" />
             <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
             <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-20 w-full" />
            </div>
        </CardContent>
        <CardFooter className="flex justify-end">
            <Skeleton className="h-10 w-32" />
        </CardFooter>
    </Card>
)

export function EditProfileForm({ onSave, initialData }: EditProfileFormProps) {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
        firstName: '',
        lastName: '',
        userName: '',
        email: '',
        roadName: '',
        aboutMe: '',
        clubName: '',
        clubChapter: '',
        rank: '',
        contactInfo: '',
        emergencyContact: '',
        clubColors: {
            primary: '#f97316',
            enabled: false,
        },
    }
  });

  useEffect(() => {
    if (initialData) {
      const profileForForm = {
        ...initialData,
        clubColors: {
            ...initialData.clubColors,
            primary: initialData.clubColors?.primary ? hslToHex(initialData.clubColors.primary) : '#f97316'
        }
      };
      reset(profileForForm);
    } else { // If no initialData, reset to default empty values
        reset({
            firstName: '',
            lastName: '',
            userName: '',
            email: '',
            roadName: '',
            aboutMe: '',
            clubName: '',
            clubChapter: '',
            rank: '',
            contactInfo: '',
            emergencyContact: '',
            clubColors: {
                primary: '#f97316',
                enabled: false,
            },
        });
    }
  }, [initialData, reset]);


  const onSubmit = async (data: ProfileFormData) => {
    if (!firestore || !user) return; // user must exist to save profile
    
    try {
      const primaryColorHsl = data.clubColors?.primary
        ? hexToHsl(data.clubColors.primary)
        : '';
        
      const profileRef = doc(firestore, 'users', user.uid);
      
      const updatedData: UserProfile = {
        id: user.uid, // Always use current user's UID
        profilePicture: initialData?.profilePicture || '', // Keep existing picture or set to empty

        // Apply form data
        ...data,    
        
        // Transform and apply specific fields
        clubColors: {
          primary: primaryColorHsl || '',
          enabled: data.clubColors?.enabled || false,
        },
      };

      await setDoc(profileRef, updatedData, { merge: true }); // Use setDoc with merge: true for creation/update
      
      toast({
          title: "Profile Updated",
          description: "Your changes have been saved.",
      });
      onSave();

    } catch (error: any) {
        const isFirestoreError = error.code && error.code.startsWith('permission-denied');
        if (isFirestoreError) {
             const profileRef = doc(firestore, 'users', user.uid);
             const permissionError = new FirestorePermissionError({
                path: profileRef.path,
                operation: 'update',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        }

       toast({
          title: 'Update Failed',
          description: error.message || 'Could not update your profile.',
          variant: 'destructive',
        });
    }
  };

  // Remove the conditional rendering of FormSkeleton
  // The parent component ProfileData will handle loading state and when to render this form.

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Edit Your Details</CardTitle>
          <CardDescription>
            Update your public profile and contact information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Profile */}
          <h3 className="text-lg font-semibold">Basic Profile</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-sm text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-sm text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="userName">Username</Label>
              <Input id="userName" {...register('userName')} />
              {errors.userName && (
                <p className="text-sm text-destructive">
                  {errors.userName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="roadName">Road Name</Label>
              <Input
                id="roadName"
                {...register('roadName')}
                placeholder="e.g., 'Slider'"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aboutMe">About Me</Label>
            <Textarea
              id="aboutMe"
              {...register('aboutMe')}
              placeholder="Tell everyone a little about yourself."
            />
          </div>

          <hr className="border-border" />

          {/* Club Info */}
          <h3 className="text-lg font-semibold">Club Information</h3>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clubName">Club Name</Label>
              <Input id="clubName" {...register('clubName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clubChapter">Club Chapter</Label>
              <Input id="clubChapter" {...register('clubChapter')} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="rank">Rank</Label>
              <Input id="rank" {...register('rank')} />
            </div>
          </div>
          <div className="space-y-4 rounded-md border p-4">
            <h4 className="text-md font-semibold">Club Colors</h4>
            <Controller
              name="clubColors.primary"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="clubColor">Club Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="clubColor"
                      type="color"
                      value={field.value || '#f97316'}
                      onChange={field.onChange}
                      className="h-10 w-12 p-1"
                    />
                    <Input
                      type="text"
                      value={field.value || '#f97316'}
                      onChange={field.onChange}
                      className="font-mono"
                    />
                  </div>
                </div>
              )}
            />
            <Controller
              name="clubColors.enabled"
              control={control}
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <Switch
                    id="clubColorEnabled"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <Label htmlFor="clubColorEnabled">
                    Enable Club Color as Theme Accent
                  </Label>
                </div>
              )}
            />
          </div>

          <hr className="border-border" />

          {/* Contact Info */}
          <h3 className="text-lg font-semibold">Contact Information</h3>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" {...register('email')} />
                {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
            </div>
          <div className="space-y-2">
            <Label htmlFor="contactInfo">Phone / Contact</Label>
            <Input id="contactInfo" {...register('contactInfo')} />
            {errors.contactInfo && (
                <p className="text-sm text-destructive">{errors.contactInfo.message}</p>
            )}
          </div>

          <hr className="border-border" />

          {/* Emergency Info */}
          <h3 className="text-lg font-semibold">Emergency Information</h3>
          <div className="space-y-2">
            <Label htmlFor="emergencyContact">Emergency Contact</Label>
            <Input
              id="emergencyContact"
              {...register('emergencyContact')}
            />
             {errors.emergencyContact && (
                <p className="text-sm text-destructive">{errors.emergencyContact.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onSave} disabled={isSubmitting}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
