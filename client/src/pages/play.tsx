import { Link } from "wouter";
import { Workspace } from "../components/workspace/Workspace";
import { useAuth } from "../lib/auth";
import { BrutalButton } from "../components/brutal";
import { LogIn, ArrowRight } from "lucide-react";

export default function PlayPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="border-b-3 border-ink bg-paper px-6 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-end gap-3 flex-wrap">
          {user ? (
            <Link href="/app/run">
              <BrutalButton variant="primary" size="sm" data-testid="button-go-to-app">
                <ArrowRight className="h-3 w-3" />
                Go to Workspace
              </BrutalButton>
            </Link>
          ) : (
            <Link href="/login">
              <BrutalButton variant="secondary" size="sm" data-testid="button-sign-in">
                <LogIn className="h-3 w-3" />
                Sign In
              </BrutalButton>
            </Link>
          )}
        </div>
      </div>
      <Workspace title="UTM Spec - Playground" />
    </div>
  );
}
