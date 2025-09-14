import Link from "next/link";
import { StethoscopeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <StethoscopeIcon className="h-6 w-6 text-primary-foreground fill-primary" />
          <span className="font-bold sm:inline-block text-lg">QueueWise</span>
        </Link>
        <nav className="flex flex-1 items-center space-x-4">
           <Button variant="ghost" asChild>
            <Link href="/">Dashboard</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/admin">Admin</Link>
          </Button>
           <Button variant="ghost" asChild>
            <Link href="/queue-status">Queue Status</Link>
          </Button>
           <Button variant="ghost" asChild>
            <Link href="/tv-display">TV Display</Link>
          </Button>
        </nav>
        <div className="flex items-center justify-end space-x-2">
           <Button variant="outline" size="sm" asChild>
            <Link href="/login">Patient Portal</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
