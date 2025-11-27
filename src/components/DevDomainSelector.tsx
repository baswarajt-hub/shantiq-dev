// src/components/DevDomainSelector.tsx
'use client';

import { useEffect, useState } from 'react';

export default function DevDomainSelector() {
  const [currentDomain, setCurrentDomain] = useState('shantiq.vercel.app');

  if (process.env.NODE_ENV !== 'development') return null;

  const domains = [
    { value: 'shantiq.vercel.app', label: 'Vercel App (Dashboard)' },
    { value: 'shantiq.in', label: 'Main Domain → /login' },
    { value: 'app.shantiq.in', label: 'Dashboard → /' },
    { value: 'doc.shantiq.in', label: 'Doctor Panel → /admin' },
    { value: 'tv1.shantiq.in', label: 'TV Display 1 → /admin/tv-display' },
    { value: 'tv2.shantiq.in', label: 'TV Display 2 → /admin/tv-display?layout=2' }
  ];

  useEffect(() => {
    const savedDomain = localStorage.getItem('dev-domain');
    if (savedDomain) {
      setCurrentDomain(savedDomain);
    }
  }, []);

  const handleDomainChange = (domain: string) => {
    localStorage.setItem('dev-domain', domain);
    setCurrentDomain(domain);
    window.location.href = '/'; // Go to root to trigger middleware
  };

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: '#f5f5f5',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <strong>🚀 Test Domain Routing:</strong>
      <select 
        value={currentDomain} 
        onChange={(e) => handleDomainChange(e.target.value)}
        style={{ marginLeft: '10px', marginTop: '5px', width: '100%' }}
      >
        {domains.map(domain => (
          <option key={domain.value} value={domain.value}>
            {domain.label}
          </option>
        ))}
      </select>
      <div style={{ fontSize: '10px', marginTop: '5px', color: '#666' }}>
        Change domain and refresh to test routing
      </div>
    </div>
  );
}