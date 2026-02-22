import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { WAITLIST_MODE } from '@/config/featureFlags';

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

  const navigate = useNavigate();
  const { toast } = useToast();

  // Ensure allowlist checks are consistent across onAuthStateChange + getSession.
  // We store a per-user promise so concurrent callers wait for the same result.
  const allowlistPromiseRef = useRef<Promise<boolean> | null>(null);
  const allowlistPromiseUserId = useRef<string | null>(null);
  const deniedToastShownForUserId = useRef<string | null>(null);

  const checkParentStatus = async (currentUser?: User | null) => {
    const u = currentUser ?? user;
    if (!u) {
      setIsNewUser(null);
      setParentId(null);
      return;
    }

    const { data, error } = await supabase
      .from('parents')
      .select('id')
      .eq('id', u.id)
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

  const enforceWaitlistAccess = (sessionUser: User): Promise<boolean> => {
    if (!WAITLIST_MODE) return Promise.resolve(true);

    // Reuse the same promise for the same user to avoid races.
    if (
      allowlistPromiseUserId.current === sessionUser.id &&
      allowlistPromiseRef.current
    ) {
      return allowlistPromiseRef.current;
    }

    allowlistPromiseUserId.current = sessionUser.id;

    allowlistPromiseRef.current = (async () => {
      if (!sessionUser.email) {
        console.warn('Waitlist mode: user has no email, denying access');
        return false;
      }

      const { data: isAllowed, error } = await supabase.rpc('is_email_allowed', {
        p_email: sessionUser.email,
      });

      if (error || !isAllowed) {
        console.warn('Waitlist mode: access denied for user', sessionUser.id);

        // Best-effort cleanup (don’t block signout if it fails)
        try {
          await supabase.functions.invoke('cleanup-unauthorized-user', {
            body: { userId: sessionUser.id },
          });
        } catch (cleanupError) {
          console.error('Cleanup failed:', cleanupError);
        }

        // Sign out locally
        await supabase.auth.signOut();

        if (deniedToastShownForUserId.current !== sessionUser.id) {
          deniedToastShownForUserId.current = sessionUser.id;
          toast({
            variant: 'destructive',
            title: 'גישה נדחתה',
            description: 'האימייל שלך לא נמצא ברשימת המורשים. הצטרף לרשימת ההמתנה.',
          });
        }

        navigate('/', { replace: true });
        return false;
      }

      return true;
    })();

    return allowlistPromiseRef.current;
  };

  const handlePostAuth = async (sessionUser: User) => {
    const allowed = await enforceWaitlistAccess(sessionUser);
    if (!allowed) return;

    await checkParentStatus(sessionUser);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Defer Supabase calls to avoid deadlocks
      if (session?.user) {
        setTimeout(() => {
          void handlePostAuth(session.user);
        }, 0);
      } else {
        setIsNewUser(null);
        setParentId(null);
        allowlistPromiseRef.current = null;
        allowlistPromiseUserId.current = null;
        deniedToastShownForUserId.current = null;
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        setTimeout(() => {
          void handlePostAuth(session.user);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsNewUser(null);
    setParentId(null);
    allowlistPromiseRef.current = null;
    allowlistPromiseUserId.current = null;
    deniedToastShownForUserId.current = null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isNewUser,
        parentId,
        signOut,
        checkParentStatus,
      }}
    >
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

