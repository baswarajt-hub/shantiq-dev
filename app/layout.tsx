// app/layout.tsx
import { SubdomainProvider } from '@/context/SubdomainContext'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SubdomainProvider>
          {children}
        </SubdomainProvider>
      </body>
    </html>
  )
}