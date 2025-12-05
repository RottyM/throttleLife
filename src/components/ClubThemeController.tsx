
'use client';

import { useUser, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useEffect, useMemo } from 'react';

export function ClubThemeController() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  
  const { data: profile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    const applyTheme = () => {
      const styleId = 'club-theme-style';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;

      // Only apply theme if a profile exists and club colors are enabled.
      if (profile?.clubColors?.enabled && profile?.clubColors?.primary) {
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = styleId;
          document.head.appendChild(styleElement);
        }
        // Apply the user's custom accent color.
        styleElement.innerHTML = `
          :root {
            --user-accent: ${profile.clubColors.primary};
          }
        `;
      } else {
        // If theme is disabled or profile doesn't have it, remove the custom style.
        if (styleElement) {
          styleElement.remove();
        }
      }
    };
    
    // CRITICAL FIX: Do not attempt to apply the theme until both user and profile loading are complete.
    // This prevents reads from Firestore before authentication is established.
    if (!isUserLoading && !isProfileLoading) {
      applyTheme();
    }

  }, [profile, isUserLoading, isProfileLoading]);

  return null; // This component does not render anything
}
