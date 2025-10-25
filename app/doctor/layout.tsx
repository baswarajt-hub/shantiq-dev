// app/doctor/layout.tsx
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function DoctorLayout({ children }: LayoutProps) {
  return (
    <div className="doctor-layout">
      <nav className="doctor-nav">
        <h1>Doctor Panel (doc.shantiq.in)</h1>
        {/* Add your doctor panel navigation here */}
      </nav>
      <main className="doctor-main">
        {children}
      </main>
    </div>
  );
}