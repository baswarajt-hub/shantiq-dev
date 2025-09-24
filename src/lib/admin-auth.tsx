
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from './firebase';
import { useRouter } from 'next/navigation';

interface AdminAuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = (password: string) => {
    // In a real app, you would manage admin emails in a secure way.
    // For this example, we'll use a hardcoded admin email.
    const adminEmail = "admin@queuewise.com";
    return signInWithEmailAndPassword(auth, adminEmail, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    router.push('/admin/login');
  };

  const value = { user, loading, signIn, signOut };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
