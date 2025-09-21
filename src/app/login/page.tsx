
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { checkUserAuthAction, getDoctorScheduleAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { StethoscopeIcon } from '@/components/icons';
import Image from 'next/image';

export default function LoginPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const [isNewUser, setIsNewUser] = useState(false);
  const [logo, setLogo] = useState<string | null | undefined>(null);

  useEffect(() => {
    async function fetchLogo() {
      const schedule = await getDoctorScheduleAction();
      setLogo(schedule?.clinicDetails?.clinicLogo);
    }
    fetchLogo();
  }, []);

  const handlePhoneSubmit = () => {
    startTransition(async () => {
      const result = await checkUserAuthAction(phone);

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      
      if (result.otp) {
        setGeneratedOtp(result.otp);
        console.log("Generated OTP for testing:", result.otp);
        setIsNewUser(!result.userExists);
        setStep('otp');
      } else if (result.userExists) {
        // Fallback for existing user if somehow OTP fails but user is found
        // In a real app with enforced OTP, this might not be needed
        localStorage.setItem('userPhone', phone);
        router.push('/booking');
      }
    });
  };

  const handleOtpSubmit = () => {
    if (otp === generatedOtp) {
      // Store phone in localStorage to simulate a session
      localStorage.setItem('userPhone', phone);
       if (isNewUser) {
           router.push('/register');
       } else {
           router.push('/booking');
       }
    } else {
      toast({
        title: 'Invalid OTP',
        description: 'The OTP you entered is incorrect.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
            {logo ? (
              <div className="relative h-16 w-16">
                <Image src={logo} alt="Clinic Logo" fill className="object-contain" />
              </div>
            ) : (
              <StethoscopeIcon className="h-12 w-12 text-primary" />
            )}
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Patient Portal</CardTitle>
            <CardDescription>
                {step === 'phone' ? 'Enter your phone number to login or register' : 'An OTP has been sent to your phone'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 'phone' && (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending}
                />
              </div>
            )}
            {step === 'otp' && (
              <div className="space-y-2">
                <Label htmlFor="otp">One-Time Password</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
            )}
          </CardContent>
          <CardFooter>
            {step === 'phone' ? (
              <Button onClick={handlePhoneSubmit} disabled={isPending || phone.length < 10} className="w-full">
                {isPending ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            ) : (
              <Button onClick={handleOtpSubmit} className="w-full">
                Verify OTP &amp; Continue
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
