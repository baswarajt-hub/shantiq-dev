// app/tv-display/page.tsx
interface PageProps {
  searchParams: Promise<{ layout?: string }>;
}

export default async function TVDisplayPage({ searchParams }: PageProps) {
  const { layout } = await searchParams;
  const currentLayout = layout || '1';
  
  return (
    <div>
      <h1>TV Display {currentLayout}</h1>
      <p>This is TV display layout {currentLayout} for {currentLayout === '1' ? 'tv1.shantiq.in' : 'tv2.shantiq.in'}</p>
      {/* Add your TV display content based on layout */}
      {currentLayout === '1' && <div>TV Layout 1 Content</div>}
      {currentLayout === '2' && <div>TV Layout 2 Content</div>}
    </div>
  );
}