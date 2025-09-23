
import Link from "next/link";
import { StethoscopeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { User, Shield, QrCode } from "lucide-react";

type HeaderProps = {
  logoSrc?: string | null;
  clinicName?: string;
};

export default function Header({ logoSrc, clinicName }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          {logoSrc ? (
            <div className="relative h-8 w-8">
              <Image src={logoSrc} alt="Clinic Logo" fill className="object-contain" />
            </div>
          ) : (
             <StethoscopeIcon className="h-6 w-6 text-primary-foreground fill-primary" />
          )}
          <span className="font-bold sm:inline-block text-lg">{clinicName || 'QueueWise'}</span>
        </Link>
        <nav className="flex flex-1 items-center space-x-2">
           <Button variant="ghost" asChild>
            <Link href="/">Dashboard</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/doctor" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold">Doctor Panel</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/admin">Admin</Link>
          </Button>
           <Button variant="ghost" asChild>
            <Link href="/login" target="_blank" rel="noopener noreferrer">Public Queue</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">TV Display</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link href="/tv-display" target="_blank" rel="noopener noreferrer">Layout 1</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/tv-display?layout=2" target="_blank" rel="noopener noreferrer">Layout 2</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        <div className="flex items-center justify-end space-x-2">
            <Button variant="outline" size="sm" asChild>
                <Link href="/walk-in" target="_blank" rel="noopener noreferrer"><QrCode className="mr-2 h-4 w-4"/>Walk-in Portal</Link>
            </Button>
           <Button variant="outline" size="sm" asChild>
            <Link href="/login" target="_blank" rel="noopener noreferrer">Patient Portal</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
