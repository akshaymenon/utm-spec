import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { getSupabase, isSupabaseConfigured } from "../../../lib/supabase/client";
import { BrutalButton, BrutalCard, BrutalCardHeader, BrutalCardContent } from "../components/brutal";
import { Mail, ArrowLeft, Check, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const draftId = params.get("draft");

  const configured = isSupabaseConfigured();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    const appUrl = window.location.origin;
    let redirectTo = `${appUrl}/app/run`;
    if (draftId) {
      redirectTo += `?draft=${draftId}`;
    }

    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <BrutalButton
          variant="ghost"
          size="sm"
          onClick={() => navigate("/play")}
          data-testid="button-back-to-play"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Playground
        </BrutalButton>

        <BrutalCard>
          <BrutalCardHeader>
            <h1 className="text-xl font-black" data-testid="text-login-title">Sign in to UTM Spec</h1>
          </BrutalCardHeader>
          <BrutalCardContent>
            {!configured ? (
              <div className="space-y-2" data-testid="login-not-configured">
                <div className="flex items-center gap-2 text-brutal-alert font-bold">
                  <AlertTriangle className="h-5 w-5" />
                  Auth not configured
                </div>
                <p className="text-sm text-muted-foreground">
                  Supabase environment variables are not set. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication.
                </p>
              </div>
            ) : status === "sent" ? (
              <div className="space-y-3" data-testid="login-sent-message">
                <div className="flex items-center gap-2 text-brutal-ok font-bold">
                  <Check className="h-5 w-5" />
                  Magic link sent
                </div>
                <p className="text-sm text-muted-foreground">
                  Check your email at <strong>{email}</strong> and click the link to sign in.
                  {draftId && " Your draft will be loaded automatically."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-bold mb-1">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="brutal-input w-full"
                    data-testid="input-email"
                  />
                </div>

                {status === "error" && (
                  <div className="flex items-center gap-2 text-brutal-alert text-sm font-bold" data-testid="text-login-error">
                    <AlertTriangle className="h-4 w-4" />
                    {errorMsg}
                  </div>
                )}

                <BrutalButton
                  type="submit"
                  disabled={status === "sending" || !email.trim()}
                  className="w-full"
                  data-testid="button-send-magic-link"
                >
                  <Mail className="h-4 w-4" />
                  {status === "sending" ? "Sending..." : "Send Magic Link"}
                </BrutalButton>

                <p className="text-xs text-muted-foreground text-center">
                  No password needed. We'll send you a magic link.
                </p>
              </form>
            )}
          </BrutalCardContent>
        </BrutalCard>
      </div>
    </div>
  );
}
