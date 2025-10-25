// app/layout.tsx
import { ReactNode } from 'react';
import { SubdomainProvider } from '../src/context/SubdomainContext';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <SubdomainProvider>
          {children}
        </SubdomainProvider>
      </body>
    </html>
  );
}