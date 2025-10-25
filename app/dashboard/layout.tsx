// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard-layout">
      <nav className="dashboard-nav">
        <h1>Dashboard (app.shantiq.in)</h1>
        {/* Add your dashboard navigation here */}
      </nav>
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  )
}