'use client';
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AdminAuthProvider, useAdminAuth } from '@/lib/admin-auth';
import { StethoscopeIcon } from '@/components/icons';

function AdminLoginForm() {
  const [password, setPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const { signIn } = useAdminAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = () => {
    startTransition(async () => {
      try {
        await signIn(password);
        toast({ title: 'Login Successful', description: 'Redirecting to dashboard...' });
        router.push('/');
      } catch (error: any) {
        console.error("Login failed:", error);
        toast({
          title: 'Login Failed',
          description: error.message || 'Please check your credentials and try again.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Admin Login</CardTitle>
        <CardDescription>
          Enter your password to access the administrative panels.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value="admin@queuewise.com" disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            disabled={isPending}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleLogin} disabled={isPending || !password} className="w-full">
          {isPending ? 'Signing In...' : 'Sign In'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AdminLoginPage() {
    return (
        <AdminAuthProvider>
            <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
                <div className="w-full max-w-sm">
                    <div className="flex justify-center mb-6">
                        <StethoscopeIcon className="h-12 w-12 text-primary" />
                    </div>
                    <AdminLoginForm />
                </div>
            </div>
        </AdminAuthProvider>
    );
}
