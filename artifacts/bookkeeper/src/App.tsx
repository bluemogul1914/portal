import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "@/context/ThemeContext";

import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Budgets from "@/pages/Budgets";
import Taxes from "@/pages/Taxes";
import Reconciliation from "@/pages/Reconciliation";
import Reports from "@/pages/Reports";
import Chat from "@/pages/Chat";
import Integrations from "@/pages/Integrations";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/budgets" component={Budgets} />
      <Route path="/taxes" component={Taxes} />
      <Route path="/reconciliation" component={Reconciliation} />
      <Route path="/reports" component={Reports} />
      <Route path="/chat" component={Chat} />
      <Route path="/integrations" component={Integrations} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
