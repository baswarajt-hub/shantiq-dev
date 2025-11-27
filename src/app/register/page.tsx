
'use client';
export const dynamic = "force-dynamic";
export const revalidate = 0;


import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { registerFamilyAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { FamilyMember } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';


export default function RegisterPage() {
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [primaryContact, setPrimaryContact] = useState<'Father' | 'Mother'>('Father');
  const [email, setEmail] = useState('');
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
    if (!fatherName || !motherName || !location || !city || !phone) {
      toast({
        title: 'Missing Information',
        description: 'Please fill out all required fields to register.',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      const result = await registerFamilyAction({
        phone,
        fatherName,
        motherName,
        primaryContact,
        location,
        city,
        email,
      });

      if ("success" in result) {
        toast({
          title: 'Registration Successful',
          description: 'Welcome! You can now manage your appointments.',
        });
        router.push('/booking');
      } else {
        toast({
          title: 'Registration Failed',
          description: result.error || 'Something went wrong. Please try again.',
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
            <CardTitle className="text-2xl">Complete Your Family Profile</CardTitle>
            <CardDescription>
              A few more details and you'll be all set.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>New Phone Number</AlertTitle>
                <AlertDescription>
                  <strong>This phone number is not registered in our system.</strong>
                  <p className="mt-1">If you have previously registered with the doctor, please contact the receptionist before completing your registration.</p>
                </AlertDescription>
            </Alert>
            <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={phone} disabled style={{ backgroundColor: '#e0e1ee' }} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="fatherName">Father's Name</Label>
                    <Input id="fatherName" value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="Father's Name" style={{ backgroundColor: '#e0e1ee' }}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="motherName">Mother's Name</Label>
                    <Input id="motherName" value={motherName} onChange={(e) => setMotherName(e.target.value)} placeholder="Mother's Name" style={{ backgroundColor: '#e0e1ee' }}/>
                </div>
            </div>
             <div className="space-y-2">
                <Label>Primary Contact</Label>
                <RadioGroup value={primaryContact} onValueChange={(value: 'Father' | 'Mother') => setPrimaryContact(value)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Father" id="father" />
                        <Label htmlFor="father">Father</Label>
                    </div>
                     <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Mother" id="mother" />
                        <Label htmlFor="mother">Mother</Label>
                    </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">The primary contact will be used for communication and as the main name on the account.</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email (Optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. parent@example.com" style={{ backgroundColor: '#e0e1ee' }}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="location">Location Area</Label>
                    <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Ameerpet" style={{ backgroundColor: '#e0e1ee' }}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Hyderabad" style={{ backgroundColor: '#e0e1ee' }}/>
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
