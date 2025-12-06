
import { useFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/types';
import { useMemo } from 'react';

export type UserProfileWithAuth = (User & Partial<UserProfile>) | null;

type UseUserProfileResult = {
  user: UserProfileWithAuth;
  isUserLoading: boolean;
  userError: Error | null;
};

export function useUserProfile(): UseUserProfileResult {
  const { user, isUserLoading, userError, firestore } = useFirebase();
  
  const userProfileQuery = useMemo(() => {
    if (user) {
      return doc(firestore, 'users', user.uid);
    }
    return null;
  }, [user, firestore]);
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileQuery);
  
  const mergedUser = useMemo(() => {
    if (user && userProfile) {
      return {
        ...user,
        ...userProfile,
      };
    }
    return user;
  }, [user, userProfile]);
  
  return {
    user: mergedUser as UserProfileWithAuth,
    isUserLoading: isUserLoading || isProfileLoading,
    userError,
  };
}
