'use client';

import { useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  ThemeToggle,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Bike,
  GalleryVertical,
  Map,
  MessageSquare,
  Newspaper,
  Trophy,
  User,
  Users,
  Bot,
  LogOut,
  LoaderCircle,
  Menu,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { useDeviceSession } from '@/hooks/use-device-session';
import { useIsMobile } from '@/hooks/use-mobile';

function DashboardLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const lastUserIdRef = useRef<string | null>(null);
  const { toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  useDeviceSession();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [isUserLoading, user, router]);

  const deactivateGps = useCallback(
    async (userId?: string) => {
      const targetUserId = userId || user?.uid;
      if (!firestore || !targetUserId) return;

      try {
        await updateDoc(doc(firestore, 'users', targetUserId), {
          gpsActive: false,
          latitude: null,
          longitude: null,
        });
      } catch (error) {
        console.error('Error deactivating GPS on logout:', error);
      }
    },
    [firestore, user]
  );

  const handleLogout = async () => {
    try {
      await deactivateGps();
    } finally {
      try {
        await signOut(auth);
        router.push('/');
      } catch (error) {
        console.error('Error signing out:', error);
      }
    }
  };

  useEffect(() => {
    if (!user) return;

    const handleSessionEnd = () => {
      deactivateGps();
    };

    window.addEventListener('pagehide', handleSessionEnd);
    window.addEventListener('beforeunload', handleSessionEnd);

    return () => {
      window.removeEventListener('pagehide', handleSessionEnd);
      window.removeEventListener('beforeunload', handleSessionEnd);
    };
  }, [deactivateGps, user]);

  useEffect(() => {
    if (user?.uid) {
      lastUserIdRef.current = user.uid;
      return;
    }

    if (!user && lastUserIdRef.current) {
      deactivateGps(lastUserIdRef.current);
      lastUserIdRef.current = null;
    }
  }, [user, deactivateGps]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const menuItems = [
    { href: '/dashboard/news', label: 'News Feed', icon: Newspaper },
    { href: '/dashboard/profile', label: 'My Profile', icon: User },
    { href: '/dashboard/gallery', label: 'Photo Gallery', icon: GalleryVertical },
    { href: '/dashboard/members', label: 'Members', icon: Users },
    { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare },
    { href: '/dashboard/locations', label: 'Locations', icon: Map },
    { href: '/dashboard/mileage-challenge', label: 'Mileage Challenge', icon: Trophy },
    { href: '/dashboard/agent', label: 'AI Agent', icon: Bot },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar>
        <SidebarRail />
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Bike className="size-5" />
            </div>
            <span className="font-headline text-lg font-semibold">
              ThrottleLife
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={{
                    children: item.label,
                    className: 'bg-primary text-primary-foreground',
                  }}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <ThemeToggle />
          <div className="flex-1 group-data-[state=collapsed]/sidebar-wrapper:hidden" />
          <Button
            variant="ghost"
            className="h-7 w-full justify-start p-1.5 group-data-[state=collapsed]/sidebar-wrapper:h-7 group-data-[state=collapsed]/sidebar-wrapper:w-7 group-data-[state=collapsed]/sidebar-wrapper:justify-center"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span className="group-data-[state=collapsed]/sidebar-wrapper:hidden">Logout</span>
          </Button>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1">
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b">
            <span className="font-headline text-lg font-semibold">
              ThrottleLife
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
            >
              <Menu />
            </Button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}