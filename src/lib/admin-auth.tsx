'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirebaseClient } from './firebase.client'; // Change this import
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
    const firebaseClient = getFirebaseClient();
    if (!firebaseClient) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseClient.auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = (password: string) => {
    const firebaseClient = getFirebaseClient();
    if (!firebaseClient) {
      throw new Error('Firebase client not initialized');
    }
    
    const adminEmail = "admin@queuewise.com";
    return signInWithEmailAndPassword(firebaseClient.auth, adminEmail, password);
  };

  const signOut = async () => {
    const firebaseClient = getFirebaseClient();
    if (!firebaseClient) {
      return;
    }
    
    await firebaseSignOut(firebaseClient.auth);
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