
'use client';
import Link from "next/link";
import { StethoscopeIcon } from "@/components/icons";
import Image from "next/image";

type DoctorHeaderProps = {
  logoSrc?: string | null;
  clinicName?: string;
};

export function DoctorHeader({ logoSrc, clinicName }: DoctorHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/doctor" className="mr-6 flex items-center space-x-2">
          {logoSrc ? (
            <div className="relative h-8 w-8">
              <Image src={logoSrc} alt="Clinic Logo" fill className="object-contain" />
            </div>
          ) : (
             <StethoscopeIcon className="h-6 w-6 text-primary-foreground fill-primary" />
          )}
          <span className="font-bold sm:inline-block text-lg">{clinicName || 'Doctor Panel'}</span>
        </Link>
      </div>
    </header>
  );
}
