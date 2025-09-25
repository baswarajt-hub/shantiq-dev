
import { getDoctorScheduleAction } from '@/app/actions';
import { StethoscopeIcon } from '@/components/icons';
import Image from 'next/image';
import { LoginForm } from './login-form';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default async function LoginPage() {
  const schedule = await getDoctorScheduleAction();
  const logo = schedule?.clinicDetails?.clinicLogo;
  const clinicName = schedule?.clinicDetails?.clinicName;

  const features = [
    "Book Appointments Anytime – No more waiting in long lines",
    "Track Your Queue Live – See your exact position in real time",
    "Doctor Availability Updates – Stay informed about delays or early availability",
    "Clinic Holidays & Schedules – Plan your visits without surprises"
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-4">
            {logo ? (
              <div className="relative h-20 w-20">
                <Image src={logo} alt="Clinic Logo" fill className="object-contain" />
              </div>
            ) : (
              <StethoscopeIcon className="h-16 w-16 text-primary" />
            )}
        </div>
        <div className="text-center mb-6">
           <h1 className="text-2xl font-bold">{clinicName}</h1>
           <p className="text-lg font-bold text-primary">Doctor Appointments & Live Queue Tracking</p>
        </div>
        
        <Card>
          <LoginForm clinicName={clinicName} />
          <CardContent className="pt-6">
            <div className="text-left text-sm text-muted-foreground space-y-3">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
