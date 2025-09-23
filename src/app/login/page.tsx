
import { getDoctorScheduleAction } from '@/app/actions';
import { StethoscopeIcon } from '@/components/icons';
import Image from 'next/image';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const schedule = await getDoctorScheduleAction();
  const logo = schedule?.clinicDetails?.clinicLogo;
  const clinicName = schedule?.clinicDetails?.clinicName;

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
        <LoginForm clinicName={clinicName} />
      </div>
    </div>
  );
}
