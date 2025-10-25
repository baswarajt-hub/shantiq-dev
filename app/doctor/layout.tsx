// app/doctor/layout.tsx
export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
  )
}