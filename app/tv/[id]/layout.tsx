// app/tv/[id]/layout.tsx
export default function TVLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  return (
    <div className="tv-layout">
      <header className="tv-header">
        <h1>TV Display {params.id} (tv{params.id}.shantiq.in)</h1>
      </header>
      <main className="tv-main">
        {children}
      </main>
    </div>
  )
}