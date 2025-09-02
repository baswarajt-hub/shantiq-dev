'use client';

import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, DollarSign, User } from 'lucide-react';
import { useTransition, useRef } from 'react';
import { addAppointmentAction } from '../actions';
import { useRouter } from 'next/navigation';

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
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Book an Appointment</CardTitle>
            <CardDescription>
              Fill out the form below to schedule your visit. A nominal fee is required to confirm your booking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" placeholder="John Doe" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" name="phone" type="tel" placeholder="555-123-4567" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointmentTime">Preferred Time</Label>
                <Input id="appointmentTime" name="appointmentTime" type="time" required />
              </div>
              <div className="space-y-2">
                <Label>Payment</Label>
                <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
                    <span className="text-muted-foreground">Consultation Fee</span>
                    <span className="font-semibold">$25.00</span>
                </div>
                 <p className="text-xs text-muted-foreground">Payment will be processed upon submission.</p>
              </div>
              
              <Button type="submit" className="w-full" disabled={isPending}>
                <DollarSign className="mr-2 h-4 w-4" />
                {isPending ? 'Processing...' : 'Pay & Book Now'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
