// app/tv-display/page.tsx
'use client';
import { useSearchParams } from 'next/navigation';

export default function TVDisplayPage() {
  const searchParams = useSearchParams();
  const layout = searchParams.get('layout') || '1';
  
  return (
    <div>
      <h1>TV Display {layout}</h1>
      <p>This is TV display layout {layout}</p>
      {/* Add your TV display content based on layout */}
      {layout === '1' && <div>TV Layout 1 Content</div>}
      {layout === '2' && <div>TV Layout 2 Content</div>}
    </div>
  );
}