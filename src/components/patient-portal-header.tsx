
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
}

export function PatientPortalHeader({ logoSrc, clinicName }: PatientPortalHeaderProps) {
  const router = useRouter();
  
  const handleLogout = () => {
    localStorage.removeItem('userPhone');
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/booking" className="mr-6 flex items-center space-x-2">
           {logoSrc ? (
            <div className="relative h-8 w-8">
              <Image src={logoSrc} alt="Clinic Logo" fill className="object-contain" />
            </div>
          ) : (
             <StethoscopeIcon className="h-6 w-6 text-primary-foreground fill-primary" />
          )}
          <span className="font-bold sm:inline-block text-lg">{clinicName || 'QueueWise Portal'}</span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-2">
           <Button variant="ghost" size="sm" asChild>
              <Link href="/booking" className="gap-2">
                <Home className="h-4 w-4" />
                Portal Home
              </Link>
            </Button>
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
