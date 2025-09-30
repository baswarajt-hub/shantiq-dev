
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { checkUserAuthAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

export function LoginForm({ clinicName }: { clinicName?: string }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const [isNewUser, setIsNewUser] = useState(false);

  const handleSuccessfulLogin = (isNew: boolean) => {
    localStorage.setItem('userPhone', phone);
    if (isNew) {
      router.push('/register');
    } else {
      router.push('/booking');
    }
  };

  const handlePhoneSubmit = () => {
    startTransition(async () => {
      const result = await checkUserAuthAction(phone);

      if ("error" in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        return;
      }
      
      // If simulation is active, bypass OTP entry immediately.
      if (result.simulation) {
        toast({ title: 'Login Successful (Simulation)', description: 'Bypassing OTP for testing.' });
        handleSuccessfulLogin(!result.userExists);
        return;
      }
      
      if (result.otp) {
        setGeneratedOtp(result.otp);
        setIsNewUser(!result.userExists);
        setStep('otp');
      }
    });
  };

  const handleOtpSubmit = () => {
    if (otp === generatedOtp) {
      handleSuccessfulLogin(isNewUser);
    } else {
      toast({
        title: 'Invalid OTP',
        description: 'The OTP you entered is incorrect.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Patient Login</CardTitle>
        <CardDescription>
            {step === 'phone' ? 'Enter your 10-digit phone number to begin' : 'An OTP has been sent to your phone'}
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
              style={{ backgroundColor: '#e0e1ee' }}
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
              style={{ backgroundColor: '#e0e1ee' }}
            />
          </div>
        )}
      </CardContent>
      <CardFooter>
        {step === 'phone' ? (
          <Button onClick={handlePhoneSubmit} disabled={isPending || phone.length < 10} className="w-full" style={{ backgroundColor: '#9d4edd' }}>
            {isPending ? 'Sending OTP...' : 'Send OTP'}
          </Button>
        ) : (
          <Button onClick={handleOtpSubmit} className="w-full" style={{ backgroundColor: '#9d4edd' }}>
            Verify OTP &amp; Continue
          </Button>
        )}
      </CardFooter>
    </>
  );
}
