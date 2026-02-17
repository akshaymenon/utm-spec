import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import NotFound from "@/pages/not-found";
import PlayPage from "@/pages/play";
import AppRunPage from "@/pages/app-run";
import LoginPage from "@/pages/login";
import AppRulesetsPage from "@/pages/app-rulesets";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/play" />
      </Route>
      <Route path="/play" component={PlayPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/app/run" component={AppRunPage} />
      <Route path="/app/rulesets" component={AppRulesetsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
