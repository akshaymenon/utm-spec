import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Workspace } from "../components/workspace/Workspace";
import { useAuth } from "../lib/auth";
import { BrutalButton, BrutalChip } from "../components/brutal";
import { LogOut, User, Settings, CreditCard } from "lucide-react";

export default function AppRunPage() {
  const { user, loading, configured, signOut, tier, openPortal } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && configured && !user) {
      navigate("/login");
    }
  }, [loading, user, configured, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="font-bold text-lg">Loading...</p>
      </div>
    );
  }

  if (configured && !user) {
    return null;
  }

  return (
    <div>
      {user && (
        <div className="border-b-3 border-ink bg-paper px-6 py-2">
          <div className="max-w-6xl mx-auto flex items-center justify-end gap-3 flex-wrap">
            <div className="flex items-center gap-2" data-testid="user-info">
              <User className="h-4 w-4" />
              <span className="text-sm font-mono" data-testid="text-user-email">{user.email}</span>
            </div>
            <BrutalChip severity={tier === "pro" ? "ok" : "info"} data-testid="chip-plan">
              {tier === "pro" ? "Pro" : "Free"}
            </BrutalChip>
            <Link href="/app/rulesets">
              <BrutalButton variant="ghost" size="sm" data-testid="link-rulesets">
                <Settings className="h-3 w-3" />
                Rulesets
              </BrutalButton>
            </Link>
            {tier === "pro" && (
              <BrutalButton
                variant="ghost"
                size="sm"
                onClick={openPortal}
                data-testid="button-billing"
              >
                <CreditCard className="h-3 w-3" />
                Billing
              </BrutalButton>
            )}
            <BrutalButton
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate("/play");
              }}
              data-testid="button-sign-out"
            >
              <LogOut className="h-3 w-3" />
              Sign Out
            </BrutalButton>
          </div>
        </div>
      )}
      <Workspace title="UTM Spec - Workspace" />
    </div>
  );
}
