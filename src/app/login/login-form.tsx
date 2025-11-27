'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CardContent, CardFooter, CardHeader, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

import { auth } from "@/lib/firebase.client";
import { RecaptchaVerifier, signInWithPhoneNumber, setPersistence, browserLocalPersistence } from "firebase/auth";

declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
  }
}

export function LoginForm({ clinicName }: { clinicName?: string }) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  // ----------------------------
  // SEND OTP TO PHONE
  // ----------------------------
  const handlePhoneSubmit = () => {
    startTransition(async () => {
      try {
        if (!phone || phone.length !== 10) {
          toast({ title: "Invalid Phone", description: "Enter a valid 10-digit number", variant: "destructive" });
          return;
        }

        await setPersistence(auth, browserLocalPersistence);

        // Setup invisible Recaptcha
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          "recaptcha-container",
          {
            size: "invisible"
          }
        );

        const confirmation = await signInWithPhoneNumber(auth, "+91" + phone, window.recaptchaVerifier);
        setConfirmationResult(confirmation);

        toast({ title: "OTP Sent", description: `A one-time password has been sent to ${phone}` });
        setStep("otp");

      } catch (error: any) {
        toast({
          title: "Error Sending OTP",
          description: String(error?.message || "Failed to send OTP"),
          variant: "destructive",
        });
      }
    });
  };

  // ----------------------------
  // VERIFY OTP
  // ----------------------------
  const handleOtpSubmit = () => {
    startTransition(async () => {
      try {
        if (!confirmationResult) {
          toast({ title: "Error", description: "No OTP session found", variant: "destructive" });
          return;
        }

        const result = await confirmationResult.confirm(otp);
        const user = result.user;

        if (user) {
          toast({ title: "Login Successful" });

          // Store phone for your app navigation
          localStorage.setItem("userPhone", phone);

          // Logic: if first-time user, redirect to register
          // Your Firestore user doc logic can be added here if needed
          router.push("/booking");
        }

      } catch (error: any) {
        toast({
          title: "Invalid OTP",
          description: String(error?.message || "OTP did not match"),
          variant: "destructive",
        });
      }
    });
  };

  // ----------------------------
  // RENDER UI
  // ----------------------------
  return (
    <>
      {/* Required for Recaptcha */}
      <div id="recaptcha-container"></div>

      <CardHeader className="text-center">
        {step === 'otp' && (
          <CardDescription>
            An OTP has been sent to your phone.
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {step === 'phone' && (
          <div className="space-y-2">
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
          <Button
            onClick={handlePhoneSubmit}
            disabled={isPending || phone.length < 10}
            className="w-full"
            style={{ backgroundColor: '#9d4edd' }}
          >
            {isPending ? 'Sending OTP...' : 'Send OTP'}
          </Button>
        ) : (
          <Button
            onClick={handleOtpSubmit}
            className="w-full"
            style={{ backgroundColor: '#9d4edd' }}
          >
            Verify OTP &amp; Continue
          </Button>
        )}
      </CardFooter>
    </>
  );
}
