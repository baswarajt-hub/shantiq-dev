// src/context/SubdomainContext.tsx
'use client'
import React, { createContext, useContext, useEffect, useState } from 'react'

type SubdomainContextType = {
  subdomain: string
  isPatient: boolean
  isDashboard: boolean
  isDoctor: boolean
  isTV: boolean
}

const SubdomainContext = createContext<SubdomainContextType | undefined>(undefined)

export function SubdomainProvider({ children }: { children: React.ReactNode }) {
  const [subdomain, setSubdomain] = useState('patient')

  useEffect(() => {
    const hostname = window.location.hostname
    const parts = hostname.split('.')
    
    let currentSubdomain = 'patient'
    if (parts.length > 2) {
      currentSubdomain = parts[0]
    } else if (hostname === 'localhost') {
      currentSubdomain = 'app' // default to dashboard in development
    }
    
    setSubdomain(currentSubdomain)
  }, [])

  const value = {
    subdomain,
    isPatient: subdomain === 'patient' || subdomain === 'www' || subdomain === 'shantiq',
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