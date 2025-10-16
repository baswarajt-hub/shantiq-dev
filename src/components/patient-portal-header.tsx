
'use client';
import Link from "next/link";
import { StethoscopeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { LogOut, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type PatientPortalHeaderProps = {
  logoSrc?: string | null;
  clinicName?: string;
  googleMapsLink?: string | null;
}

export function PatientPortalHeader({ logoSrc, clinicName, googleMapsLink }: PatientPortalHeaderProps) {
  const router = useRouter();
  
  const handleLogout = () => {
    localStorage.removeItem('userPhone');
    router.push('/login');
  };

  const LogoLinkWrapper = googleMapsLink
    ? ({ children }: { children: React.ReactNode }) => (
      <a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center text-center">
        {children}
      </a>
    )
    : ({ children }: { children: React.ReactNode }) => (
      <Link href="/booking" className="flex flex-col items-center justify-center text-center">
        {children}
      </Link>
    );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/booking" className="gap-2">
            <Home className="h-4 w-4" />
            Home
          </Link>
        </Button>
        
        <LogoLinkWrapper>
           {logoSrc ? (
            <div className="relative h-10 w-10">
              <Image src={logoSrc} alt="Clinic Logo" fill className="object-contain" />
            </div>
          ) : (
             <StethoscopeIcon className="h-6 w-6 text-primary-foreground fill-primary" />
          )}
          <span className="font-bold sm:inline-block text-xs text-center">{clinicName || 'QueueWise Portal'}</span>
        </LogoLinkWrapper>
        
        <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}

    