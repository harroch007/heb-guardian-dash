import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isNewUser: boolean | null;
  parentId: string | null;
  signOut: () => Promise<void>;
  checkParentStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);

  const checkParentStatus = async () => {
    if (!user) {
      setIsNewUser(null);
      setParentId(null);
      return;
    }

    const { data, error } = await supabase
      .from('parents')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error checking parent status:', error);
      setIsNewUser(true);
      return;
    }

    if (data) {
      setIsNewUser(false);
      setParentId(data.id);
    } else {
      setIsNewUser(true);
      setParentId(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Defer parent check to avoid deadlocks
        if (session?.user) {
          setTimeout(() => {
            checkParentStatus();
          }, 0);
        } else {
          setIsNewUser(null);
          setParentId(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        setTimeout(() => {
          checkParentStatus();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsNewUser(null);
    setParentId(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      isNewUser, 
      parentId,
      signOut,
      checkParentStatus 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
