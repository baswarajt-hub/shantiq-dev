import Link from "next/link";
import { StethoscopeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Eye, Tv } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <StethoscopeIcon className="h-6 w-6 text-primary-foreground fill-primary" />
          <span className="font-bold sm:inline-block text-lg">QueueWise</span>
        </Link>
        <nav className="flex flex-1 items-center space-x-4">
          <Link href="/appointment" legacyBehavior passHref>
            <Button variant="ghost">Book Appointment</Button>
          </Link>
        </nav>
        <div className="flex items-center justify-end space-x-2">
          <Link href="/queue-status" legacyBehavior passHref>
            <Button variant="outline" size="sm" className="gap-2">
              <Eye className="h-4 w-4" />
              Queue Status
            </Button>
          </Link>
          <Link href="/tv-display" legacyBehavior passHref>
            <Button variant="outline" size="sm" className="gap-2">
              <Tv className="h-4 w-4" />
              TV Display
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
