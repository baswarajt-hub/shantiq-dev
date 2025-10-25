// app/tv/[id]/page.tsx
export default function TVPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <div>
      <h1>TV Display {params.id}</h1>
      <p>This is TV display {params.id} for tv{params.id}.shantiq.in</p>
      {/* Add your TV display content here */}
    </div>
  )
}