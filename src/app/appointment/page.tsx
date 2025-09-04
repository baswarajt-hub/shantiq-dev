
'use client';

import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, User } from 'lucide-react';
import { useTransition, useRef } from 'react';
import { addAppointmentAction } from '../actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AppointmentPage() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    // Simulate payment
    toast({ title: 'Processing Payment...', description: 'Please wait while we process your payment.' });

    startTransition(async () => {
      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const result = await addAppointmentAction(formData);

      if (result.error) {
        toast({ title: 'Booking Failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Booking Successful!', description: 'Your appointment has been booked and payment is confirmed.' });
        formRef.current?.reset();
        router.push('/queue-status');
      }
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
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
