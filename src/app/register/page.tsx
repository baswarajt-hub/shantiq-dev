
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { registerUserAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [location, setLocation] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const userPhone = localStorage.getItem('userPhone');
    if (!userPhone) {
      router.push('/login');
    } else {
      setPhone(userPhone);
    }
  }, [router]);

  const handleRegister = () => {
    if (!name || !gender || !dob || !location || !city || !phone) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all fields to register.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await registerUserAction({
        phone,
        name,
        dob,
        gender,
        location,
        city,
      });

      if (result.success) {
        toast({
          title: 'Registration Successful',
          description: 'Welcome! You can now manage your appointments.',
        });
        router.push('/booking');
      } else {
        toast({
          title: 'Registration Failed',
          description: 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      }
    });
  };

  if (!phone) {
    return null; // or a loading spinner
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
            <CardDescription>
              A few more details and you'll be all set.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={phone} disabled />
            </div>
             <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="As per your records" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="location">Location Area</Label>
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Ameerpet" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Hyderabad" />
                </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleRegister} disabled={isPending} className="w-full">
              {isPending ? 'Registering...' : 'Complete Registration'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
