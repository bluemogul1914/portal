import { useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { useWaveStatus, useStripeStatus, useSyncWave, useSyncStripe } from "@/hooks/use-integrations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlaidLink } from "react-plaid-link";
import {
  RefreshCw, CheckCircle2, XCircle, ExternalLink, Info, Key,
  Zap, Copy, Check, Landmark, CreditCard, Building2, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function StatusBadge({ connected, label }: { connected: boolean; label?: string }) {
  return connected ? (
    <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1 text-[11px]">
      <CheckCircle2 className="w-3 h-3" /> {label || "Connected"}
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1 text-[11px]">
      <XCircle className="w-3 h-3" /> {label || "Not Connected"}
    </Badge>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded hover:bg-muted transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    POST: "bg-green-500/10 text-green-400 border-green-500/20",
    PUT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={`text-[9px] font-bold px-1.5 h-4 font-mono ${colors[method] || ""}`}>
      {method}
    </Badge>
  );
}

export default function Integrations() {
  const { data: waveStatus, isLoading: waveLoading } = useWaveStatus();
  const { data: stripeStatus, isLoading: stripeLoading } = useStripeStatus();
  const waveSync = useSyncWave();
  const stripeSync = useSyncStripe();
  const { toast } = useToast();
  const qc = useQueryClient();

  // n8n config info
  const { data: n8nInfo } = useQuery({
    queryKey: ["n8n", "info"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/n8n/info`);
      return r.json() as Promise<{
        configured: boolean;
        keyHint: string | null;
        plaidConfigured: boolean;
        plaidBankLinked: boolean;
        baseUrl: string;
        endpoints: { method: string; path: string; description: string }[];
      }>;
    },
  });

  // Plaid status
  const { data: plaidStatus, refetch: refetchPlaid } = useQuery({
    queryKey: ["plaid", "status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/plaid/status`);
      return r.json() as Promise<{ connected: boolean; configured: boolean; bankLinked: boolean; message: string; env: string }>;
    },
  });

  // Plaid link token
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const fetchLinkToken = async () => {
    const r = await fetch(`${BASE}/api/plaid/link-token`, { method: "POST" });
    const d = await r.json() as any;
    if (d.linkToken) setLinkToken(d.linkToken);
    else toast({ title: "Cannot connect Plaid", description: d.error, variant: "destructive" });
  };

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      const r = await fetch(`${BASE}/api/plaid/exchange-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken, institutionName: metadata.institution?.name }),
      });
      const d = await r.json() as any;
      if (d.success) {
        toast({ title: "Bank linked!", description: `${metadata.institution?.name} connected via Plaid.` });
        refetchPlaid();
        qc.invalidateQueries({ queryKey: ["n8n", "info"] });
      } else {
        toast({ title: "Failed to link bank", description: d.error, variant: "destructive" });
      }
      setLinkToken(null);
    },
    onExit: () => setLinkToken(null),
  });

  // Open Plaid Link (fetch token then open)
  const connectBank = async () => {
    await fetchLinkToken();
  };

  // Auto-open when token is ready
  const [didOpen, setDidOpen] = useState(false);
  if (linkToken && plaidReady && !didOpen) {
    setDidOpen(true);
    openPlaid();
    setTimeout(() => setDidOpen(false), 1000);
  }

  // Plaid sync
  const plaidSync = useMutation({
    mutationFn: async (days: number) => {
      const r = await fetch(`${BASE}/api/plaid/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      return r.json() as Promise<{ success: boolean; imported: number; message: string }>;
    },
    onSuccess: (d) => {
      toast({ title: d.success ? "Bank Sync Complete" : "Sync Info", description: d.message });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  // Wave vendor sync
  const waveVendorSync = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/wave/vendors/sync`, { method: "POST" });
      return r.json() as Promise<{ success: boolean; imported: number; updated: number; message: string }>;
    },
    onSuccess: (d) => toast({ title: "Vendors synced", description: d.message }),
  });

  const apiBaseUrl = n8nInfo?.baseUrl || `https://eecc267a-f459-4fec-8698-6530d948b855-00-3abobnab7yzxg.kirk.replit.dev`;

  return (
    <Layout>
      <div className="p-5 lg:p-7 space-y-7 max-w-5xl mx-auto animate-in fade-in duration-300">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Connect your financial tools to automatically sync data.</p>
        </div>

        {/* ── n8n Automation ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Automation</h2>
          <Card className="glass-panel border-[#ea4b71]/20 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#ea4b71] via-[#ff6d9f] to-[#ea4b71]" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#ea4b71]/10 border border-[#ea4b71]/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#ea4b71]" />
                  </div>
                  <span>n8n Bookkeeping Agent</span>
                  <a href="https://n8n.bluemogul.us" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <StatusBadge connected={!!n8nInfo?.configured} label={n8nInfo?.configured ? "API Ready" : "Configuring"} />
              </CardTitle>
              <CardDescription className="text-xs">
                Your n8n agent at <span className="font-mono text-foreground">n8n.bluemogul.us</span> connects to this bookkeeper for live client data, overdue invoices, and P&L reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* API Key */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Key className="w-3.5 h-3.5 text-[#ea4b71]" />
                  API Key for n8n HTTP nodes
                </div>
                <div className="flex items-center gap-2 font-mono text-xs bg-background border border-border rounded px-3 py-2">
                  <span className="flex-1 text-primary">{n8nInfo?.keyHint || "Loading..."}</span>
                  <CopyButton value={`(copy from Replit Secrets → BOOKKEEPER_API_KEY)`} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  In your n8n HTTP nodes: <span className="font-mono bg-muted px-1 rounded">Authorization: Bearer {"{{$env.BOOKKEEPER_API_KEY}}"}</span>
                </p>
              </div>

              {/* Endpoint reference */}
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">API Endpoints — configure in your n8n workflow</p>
                <div className="rounded-lg border border-border overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground">
                    <span className="col-span-1">Method</span>
                    <span className="col-span-5">Endpoint</span>
                    <span className="col-span-6">Used in n8n workflow</span>
                  </div>
                  {[
                    { method: "GET",  path: "/api/n8n/summary",       workflow: "YTD income, expenses, net profit & margin" },
                    { method: "GET",  path: "/api/n8n/cashflow",       workflow: "Monthly cash flow Jan–current month" },
                    { method: "GET",  path: "/api/n8n/invoices",       workflow: "All Wave invoices with status (?status=OVERDUE)" },
                    { method: "GET",  path: "/api/n8n/taxes",          workflow: "TX 8.25% sales tax + SE tax on net profit" },
                    { method: "GET",  path: "/api/n8n/reconciliation", workflow: "Unreconciled transactions" },
                    { method: "GET",  path: "/api/n8n/overdue",        workflow: "Weekly AR Check → Get Overdue Invoices" },
                    { method: "GET",  path: "/api/n8n/clients",        workflow: "Monthly Invoicing → Get Active Clients" },
                    { method: "POST", path: "/api/n8n/log",            workflow: "Weekly AR Check → Log to Blue Mogul Portal" },
                    { method: "POST", path: "/api/n8n/transaction",    workflow: "Create transaction from any workflow" },
                  ].map(ep => (
                    <div key={ep.path} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/40 last:border-0 items-center hover:bg-muted/20 transition-colors">
                      <div className="col-span-1">
                        <MethodBadge method={ep.method} />
                      </div>
                      <div className="col-span-5 flex items-center gap-1.5">
                        <code className="text-[10px] font-mono text-foreground truncate">{apiBaseUrl}{ep.path}</code>
                        <CopyButton value={`${apiBaseUrl}${ep.path}`} />
                      </div>
                      <span className="col-span-6 text-[10px] text-muted-foreground">{ep.workflow}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs border-[#ea4b71]/20 text-[#ea4b71] hover:bg-[#ea4b71]/10" asChild>
                <a href="https://n8n.bluemogul.us" target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open n8n Agent Dashboard
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* ── Banking ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Banking</h2>
          <Card className="glass-panel overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#00C07E] to-[#00A367]" />
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#00C07E]/10 border border-[#00C07E]/20 flex items-center justify-center">
                    <Landmark className="w-4 h-4 text-[#00C07E]" />
                  </div>
                  Relay Financial via Plaid
                </div>
                {plaidStatus ? (
                  <StatusBadge
                    connected={plaidStatus.bankLinked}
                    label={plaidStatus.bankLinked ? "Bank Linked" : plaidStatus.configured ? "Credentials Set" : "Setup Needed"}
                  />
                ) : null}
              </CardTitle>
              <CardDescription className="text-xs">
                Connect your Relay Financial checking accounts to auto-import all bank transactions as expenses and income.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!plaidStatus?.configured && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200/80">
                    <span className="font-semibold text-amber-400">Plaid credentials needed:</span> Add{" "}
                    <code className="bg-muted px-1 rounded font-mono text-amber-300">PLAID_CLIENT_ID</code> and{" "}
                    <code className="bg-muted px-1 rounded font-mono text-amber-300">PLAID_SECRET</code> to your Replit Secrets from{" "}
                    <a href="https://dashboard.plaid.com/developers/keys" target="_blank" rel="noreferrer" className="underline text-amber-400">dashboard.plaid.com</a>.
                  </div>
                </div>
              )}

              {plaidStatus?.configured && !plaidStatus?.bankLinked && (
                <p className="text-xs text-muted-foreground">
                  Credentials are set. Click below to link your Relay Financial bank account via Plaid's secure bank selector.
                </p>
              )}

              {plaidStatus?.bankLinked && (
                <div className="flex items-center gap-2 rounded-lg bg-success/5 border border-success/20 px-3 py-2.5 text-xs text-success">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Bank account linked! Sync transactions below.
                </div>
              )}

              <div className="flex gap-2">
                {!plaidStatus?.bankLinked ? (
                  <Button
                    onClick={connectBank}
                    disabled={!plaidStatus?.configured}
                    className="flex-1 h-8 text-xs bg-[#00C07E] hover:bg-[#00A367] text-white gap-2"
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    Connect Relay Financial
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => plaidSync.mutate(30)}
                      disabled={plaidSync.isPending}
                      className="flex-1 h-8 text-xs bg-[#00C07E] hover:bg-[#00A367] text-white gap-2"
                    >
                      {plaidSync.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Sync Last 30 Days
                    </Button>
                    <Button
                      onClick={() => plaidSync.mutate(90)}
                      disabled={plaidSync.isPending}
                      variant="outline"
                      className="h-8 text-xs gap-1.5"
                    >
                      90 Days
                    </Button>
                  </>
                )}
              </div>

              {plaidSync.data && (
                <p className={`text-xs text-center ${plaidSync.data.success ? "text-success" : "text-muted-foreground"}`}>
                  {plaidSync.data.message}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Accounting & Payments ────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">Accounting & Payments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Wave */}
            <Card className="glass-panel overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-blue-400 to-blue-600" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-400">W</span>
                    </div>
                    Wave Accounting
                  </div>
                  {waveLoading ? null : <StatusBadge connected={!!waveStatus?.connected} />}
                </CardTitle>
                <CardDescription className="text-xs">Sync invoices and vendor contacts from Wave.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{waveStatus?.message || "Not connected"}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => waveSync.mutate()}
                    disabled={waveSync.isPending || !waveStatus?.connected}
                    size="sm"
                    className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  >
                    {waveSync.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Sync Invoices
                  </Button>
                  <Button
                    onClick={() => waveVendorSync.mutate()}
                    disabled={waveVendorSync.isPending || !waveStatus?.connected}
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                  >
                    {waveVendorSync.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Building2 className="w-3 h-3" />}
                    Vendors
                  </Button>
                </div>
                {(waveSync.data || waveVendorSync.data) && (
                  <p className={`text-xs text-center ${(waveSync.data?.success || waveVendorSync.data?.success) ? "text-success" : "text-destructive"}`}>
                    {waveSync.data?.message || waveVendorSync.data?.message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Stripe */}
            <Card className="glass-panel overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-[#635BFF] to-[#8C85FF]" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#635BFF]/10 border border-[#635BFF]/20 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-[#635BFF]" />
                    </div>
                    Stripe Payments
                  </div>
                  {stripeLoading ? null : <StatusBadge connected={!!stripeStatus?.connected} />}
                </CardTitle>
                <CardDescription className="text-xs">Auto-import customer payments and refunds.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{stripeStatus?.message || "Not connected"}</p>
                <Button
                  onClick={() => stripeSync.mutate()}
                  disabled={stripeSync.isPending || !stripeStatus?.connected}
                  size="sm"
                  className="w-full h-8 text-xs bg-[#635BFF] hover:bg-[#524be0] text-white gap-1.5"
                >
                  {stripeSync.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sync Payments
                </Button>
                {stripeSync.data && (
                  <p className={`text-xs text-center ${stripeSync.data.success ? "text-success" : "text-destructive"}`}>
                    {stripeSync.data.message}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

      </div>
    </Layout>
  );
}
