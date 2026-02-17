import { BrutalButton, BrutalCard, BrutalCardHeader, BrutalCardContent, BrutalChip } from "../brutal";
import { Lock, Zap, X, Check } from "lucide-react";
import { useAuth } from "../../lib/auth";

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  feature: string;
  onUpgrade: () => void;
  onLogin?: () => void;
}

const PRO_FEATURES = [
  "Unlimited row processing",
  "CSV export",
  "Up to 50 saved rulesets",
  "Priority support",
];

export function PaywallModal({ open, onClose, feature, onUpgrade, onLogin }: PaywallModalProps) {
  const { user } = useAuth();

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-ink/30"
        onClick={onClose}
        data-testid="paywall-overlay"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <BrutalCard className="w-full max-w-md">
          <BrutalCardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-brutal-accent" />
                <h2 className="text-lg font-black" data-testid="text-paywall-title">
                  Upgrade to Pro
                </h2>
              </div>
              <BrutalButton variant="ghost" size="icon" onClick={onClose} data-testid="button-paywall-close">
                <X className="h-5 w-5" />
              </BrutalButton>
            </div>
          </BrutalCardHeader>
          <BrutalCardContent>
            <div className="space-y-4">
              <div className="border-3 border-ink bg-brutal-warn/10 px-3 py-2" data-testid="text-paywall-reason">
                <p className="text-sm font-bold">
                  {feature} requires a Pro plan.
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-black">$19</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                  <BrutalChip severity="ok">Save 17% yearly</BrutalChip>
                </div>

                <ul className="space-y-2">
                  {PRO_FEATURES.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-brutal-ok flex-shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                {!user && onLogin ? (
                  <>
                    <BrutalButton onClick={onLogin} data-testid="button-paywall-login">
                      Sign in first
                    </BrutalButton>
                    <p className="text-xs text-center text-muted-foreground">
                      You need to sign in before upgrading
                    </p>
                  </>
                ) : (
                  <BrutalButton onClick={onUpgrade} data-testid="button-paywall-upgrade">
                    <Zap className="h-4 w-4" />
                    Upgrade to Pro
                  </BrutalButton>
                )}
              </div>
            </div>
          </BrutalCardContent>
        </BrutalCard>
      </div>
    </>
  );
}
