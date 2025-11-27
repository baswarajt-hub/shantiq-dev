
'use client';

import { useAdminAuth } from '@/lib/admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '../ui/skeleton';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/admin/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95">
          <div className="container flex h-14 items-center">
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <main className="flex-1 container mx-auto p-4 md:p-6 lg:p-8">
            <div className="space-y-6">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-96 w-full" />
            </div>
        </main>
      </div>
    );
  }

  return <>{children}</>;
}
