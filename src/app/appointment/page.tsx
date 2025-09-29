
'use client';

import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function AppointmentPage() {

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header logoSrc={null} />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
            <CardTitle className="text-4xl mb-4">Patient Portal is now Live!</CardTitle>
            <CardDescription className="text-lg mb-8 text-muted-foreground">
                Our new patient portal offers a more streamlined way to book and manage appointments for your entire family. Please use the new portal for all future bookings.
            </CardDescription>
            <Button asChild size="lg">
                <Link href="/booking">Go to Patient Portal</Link>
            </Button>
        </div>
      </main>
    </div>
  );
}
