
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAuth, useUser, useFirestore } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  UserCredential,
  GoogleAuthProvider,
  GithubAuthProvider,
  type AuthProvider,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Bike, LoaderCircle } from 'lucide-react';
import Image from 'next/image';
import type { UserProfile } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('login'); // 'login', 'signup', 'forgot-password'

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const providerOptions: Array<{
    id: string;
    label: string;
    createProvider: () => AuthProvider;
  }> = [
    { id: 'google', label: 'Continue with Google', createProvider: () => new GoogleAuthProvider() },
    { id: 'github', label: 'Continue with GitHub', createProvider: () => new GithubAuthProvider() },
  ];

  useEffect(() => {
    if (user) {
      const isNewUser = localStorage.getItem('isNewUser') === 'true';
      if (isNewUser) {
        localStorage.removeItem('isNewUser');
        router.push('/dashboard/profile');
      } else {
        router.push('/dashboard/news');
      }
    }
  }, [user, router]);

  const handleAuthAction = async (isSignUp: boolean) => {
    if (!auth || !firestore) return;
    setLoading(true);
    try {
      let userCredential: UserCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        // Create a new user profile document in Firestore
        const userProfileRef = doc(firestore, 'users', newUser.uid);
        const newProfile: UserProfile = {
          id: newUser.uid,
          email: newUser.email || '',
          userName: newUser.email?.split('@')[0] || `user_${newUser.uid.substring(0, 5)}`,
          firstName: '',
          lastName: '',
          clubColors: {
            primary: "24.6 95% 53.1%",
            enabled: false,
          },
          profilePicture: '', // Explicitly set to empty string for testing
        };
        // This is a critical write operation. If it fails due to security rules,
        // the user will be stuck. We need proper error handling.
        setDoc(userProfileRef, newProfile).catch(serverError => {
            const permissionError = new FirestorePermissionError({
              path: userProfileRef.path,
              operation: 'create',
              requestResourceData: newProfile,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                title: 'Profile Creation Failed',
                description: 'Could not create your user profile. Please check permissions.',
                variant: 'destructive',
            });
        });
        
        // Set a flag to indicate a new user sign-up for redirection to profile page
        localStorage.setItem('isNewUser', 'true');

      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      // The useEffect will handle the redirect.
    } catch (error: any) {
      toast({
        title: 'Authentication Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleAuthAction(false);
  };

  const handleSignupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleAuthAction(true);
  };

  const handleProviderLogin = async (providerId: string) => {
    if (!auth) return;
    const providerConfig = providerOptions.find((provider) => provider.id === providerId);
    if (!providerConfig) return;

    setLoading(true);
    try {
      await signInWithPopup(auth, providerConfig.createProvider());
    } catch (error: any) {
      const message =
        error?.code === 'auth/operation-not-allowed'
          ? 'This provider is not enabled yet. Enable it in Firebase console and try again.'
          : error?.message || 'Please try again or use email login.';
      toast({
        title: 'Provider Sign-in Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth) return;
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'Check your inbox for a link to reset your password.',
      });
      setActiveView('login');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const renderContent = () => {
    if (activeView === 'forgot-password') {
       return (
        <Card className="border-white/20 bg-white/10 text-primary-foreground backdrop-blur-md">
          <CardHeader>
            <CardTitle className="font-headline text-white">Reset Password</CardTitle>
            <CardDescription className="text-white/80">
              Enter your email to receive a password reset link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-white/80">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handlePasswordReset}
              disabled={loading || !email}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            <Button variant="link" className="text-white/60" onClick={() => setActiveView('login')}>
                Back to Login
            </Button>
          </CardFooter>
        </Card>
      );
    }
    
    return (
       <Tabs value={activeView} onValueChange={(v) => setActiveView(v)}>
          <TabsList className="grid w-full grid-cols-2 bg-white/10 text-primary-foreground backdrop-blur-sm">
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-white/90 data-[state=active]:text-black"
            >
              Login
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              className="data-[state=active]:bg-white/90 data-[state=active]:text-black"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <Card className="border-white/20 bg-white/10 text-primary-foreground backdrop-blur-md">
              <form onSubmit={handleLoginSubmit}>
                <CardHeader>
                  <CardTitle className="font-headline text-white">Login</CardTitle>
                  <CardDescription className="text-white/80">
                    Welcome back. Please enter your credentials to login.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-white/80">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="m@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password"  className="text-white/80">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                  <Button
                    type="submit"
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={loading}
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-sm font-normal text-white/60"
                    onClick={() => setActiveView('forgot-password')}
                  >
                    Forgot Password?
                  </Button>
                </CardFooter>
              </form>
            </Card>
            <div className="mt-4 space-y-2">
              <p className="text-center text-xs text-white/60">Or continue with</p>
              {providerOptions.map((provider) => (
                <Button
                  key={provider.id}
                  type="button"
                  variant="outline"
                  className="w-full border-white/20 bg-white/5 text-white hover:bg-white/20"
                  onClick={() => handleProviderLogin(provider.id)}
                  disabled={loading}
                >
                  {provider.label}
                </Button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="signup">
            <Card className="border-white/20 bg-white/10 text-primary-foreground backdrop-blur-md">
              <form onSubmit={handleSignupSubmit}>
                <CardHeader>
                  <CardTitle className="font-headline text-white">Sign Up</CardTitle>
                  <CardDescription className="text-white/80">
                    Create an account to get started with ThrottleLife.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email"  className="text-white/80">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="m@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password"  className="text-white/80">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="border-whte/20 bg-white/5 text-white placeholder:text-white/40"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    disabled={loading}
                  >
                    {loading ? 'Creating account...' : 'Sign Up'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <Image
        src="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=2070&auto=format&fit=crop"
        alt="A motorcycle on a scenic road"
        fill
        className="object-cover"
        data-ai-hint="motorcycle road"
        priority
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-primary-foreground">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 p-2 backdrop-blur-sm">
            <Bike className="size-8 text-white" />
          </div>
          <h1 className="mt-4 font-headline text-4xl font-bold text-white">
            ThrottleLife
          </h1>
          <p className="text-white/80">
            Your journey starts here.
          </p>
        </div>
        {renderContent()}
      </div>
    </div>
  );
}
