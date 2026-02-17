import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getSupabase, isSupabaseConfigured } from "../../../lib/supabase/client";
import { isPro, getPlanTier, getMaxRows, getMaxRulesets, canExportCSV, type PlanTier } from "../../../lib/entitlements";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "../../../shared/schema";

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  tier: PlanTier;
  maxRows: number;
  maxRulesets: number;
  csvExport: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  startCheckout: (priceId: string) => Promise<void>;
  openPortal: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  configured: false,
  tier: "guest",
  maxRows: 10,
  maxRulesets: 0,
  csvExport: false,
  signOut: async () => {},
  refreshProfile: async () => {},
  startCheckout: async () => {},
  openPortal: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  const isGuest = !user;
  const tier = getPlanTier(profile, isGuest);
  const maxRows = getMaxRows(profile, isGuest);
  const maxRulesets = getMaxRulesets(profile, isGuest);
  const csvExport = canExportCSV(profile, isGuest);

  async function fetchProfile(userId: string) {
    try {
      const res = await fetch(`/api/profile/${userId}`);
      if (res.ok) {
        const p = await res.json();
        setProfile(p);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  }

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        upsertProfile(session.user.id, session.user.email ?? "").then(() => {
          fetchProfile(session.user.id);
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        upsertProfile(session.user.id, session.user.email ?? "").then(() => {
          fetchProfile(session.user.id);
        });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const signOut = useCallback(async () => {
    if (!configured) return;
    await getSupabase().auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, [configured]);

  const startCheckout = useCallback(async (priceId: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          priceId,
          successUrl: `${window.location.origin}/app/run?checkout=success`,
          cancelUrl: `${window.location.origin}/app/run?checkout=canceled`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Failed to start checkout:", err);
    }
  }, [user]);

  const openPortal = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          returnUrl: `${window.location.origin}/app/run`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Failed to open portal:", err);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, configured,
      tier, maxRows, maxRulesets, csvExport,
      signOut, refreshProfile, startCheckout, openPortal,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

async function upsertProfile(id: string, email: string) {
  try {
    await fetch("/api/profile/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email }),
    });
  } catch (err) {
    console.error("Failed to upsert profile:", err);
  }
}

export function saveDraftToLocal(draftId: string, payload: any) {
  try {
    localStorage.setItem(`utm_draft_${draftId}`, JSON.stringify(payload));
  } catch {}
}

export function loadDraftFromLocal(draftId: string): any | null {
  try {
    const raw = localStorage.getItem(`utm_draft_${draftId}`);
    if (raw) {
      localStorage.removeItem(`utm_draft_${draftId}`);
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}
