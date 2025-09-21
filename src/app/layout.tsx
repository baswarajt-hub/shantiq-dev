import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { getDoctorScheduleAction } from './actions';
import Header from '@/components/header';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'QueueWise',
  description: 'A smart queue management system for clinics.',
  manifest: '/manifest.json'
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // The error indicates that the Header was fetching data in a way that caused a waterfall.
  // By making the RootLayout a server component that fetches the data and passes it down,
  // we adhere to Next.js best practices and resolve the rendering issue.
  // This approach is not suitable for all pages, some pages might not need the header.
  // But for this app, all pages except the booking ones use the main header.
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
        <Script src="https://ebz-static.s3.ap-south-1.amazonaws.com/easebuzz-checkout.js" strategy="beforeInteractive" />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
