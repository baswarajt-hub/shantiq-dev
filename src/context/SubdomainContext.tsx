// src/context/SubdomainContext.tsx
'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'

type SubdomainContextType = {
  subdomain: string
  isPatient: boolean
  isDashboard: boolean
  isDoctor: boolean
  isTV: boolean
  tvLayout: string
}

const SubdomainContext = createContext<SubdomainContextType | undefined>(undefined)

export function SubdomainProvider({ children }: { children: React.ReactNode }) {
  const [subdomain, setSubdomain] = useState('shantiq')
  const [tvLayout, setTvLayout] = useState('1')

  useEffect(() => {
    const hostname = window.location.hostname
    const parts = hostname.split('.')
    
    let currentSubdomain = 'shantiq'
    let currentTvLayout = '1'
    
    if (parts.length > 2) {
      currentSubdomain = parts[0]
      if (currentSubdomain.startsWith('tv')) {
        currentTvLayout = currentSubdomain.replace('tv', '') || '1'
      }
    }
    
    setSubdomain(currentSubdomain)
    setTvLayout(currentTvLayout)
  }, [])

  const value = {
    subdomain,
    tvLayout,
    isPatient: subdomain === 'shantiq' || subdomain === 'www',
    isDashboard: subdomain === 'app',
    isDoctor: subdomain === 'doc',
    isTV: subdomain.startsWith('tv')
  }

  return (
    <SubdomainContext.Provider value={value}>
      {children}
    </SubdomainContext.Provider>
  )
}

export function useSubdomain() {
  const context = useContext(SubdomainContext)
  if (context === undefined) {
    throw new Error('useSubdomain must be used within a SubdomainProvider')
  }
  return context
}