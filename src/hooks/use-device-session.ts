'use client';

import { useEffect, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

const DEVICE_ID_KEY = 'throttlelife_device_id';

const getOrCreateDeviceId = (): string | null => {
  if (typeof window === 'undefined') return null;

  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const freshId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(DEVICE_ID_KEY, freshId);
  return freshId;
};

export const useDeviceSession = () => {
  const { firestore, user } = useFirebase();
  const registeredDeviceId = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !firestore) {
      registeredDeviceId.current = null;
      return;
    }
    if (typeof window === 'undefined') return;

    const deviceId = getOrCreateDeviceId();
    if (!deviceId) return;

    const deviceRef = doc(firestore, `users/${user.uid}/devices/${deviceId}`);

    const upsertSession = async (payload: Record<string, unknown>) => {
      try {
        await setDoc(deviceRef, payload, { merge: true });
      } catch (error) {
        console.error('Failed to update device session', error);
      }
    };

    const basePayload = {
      deviceId,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      lastActiveAt: serverTimestamp(),
    };

    const initialPayload =
      registeredDeviceId.current === deviceId
        ? basePayload
        : { ...basePayload, createdAt: serverTimestamp() };

    upsertSession(initialPayload);
    registeredDeviceId.current = deviceId;

    const touchLastActive = () => upsertSession({ lastActiveAt: serverTimestamp() });
    const handleVisibility = () => {
      if (!document.hidden) {
        touchLastActive();
      }
    };

    window.addEventListener('focus', touchLastActive);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', touchLastActive);
      document.removeEventListener('visibilitychange', handleVisibility);
      touchLastActive();
    };
  }, [firestore, user]);
};
