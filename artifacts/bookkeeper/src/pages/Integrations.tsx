import { Layout } from "@/components/Layout";
import { useWaveStatus, useStripeStatus, useSyncWave, useSyncStripe } from "@/hooks/use-integrations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, ExternalLink, Info, Key } from "lucide-react";
import { format } from "date-fns";

function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Connected
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
      <XCircle className="w-3 h-3" /> Not Connected
    </Badge>
  );
}

export default function Integrations() {
  const { data: waveStatus, isLoading: waveLoading } = useWaveStatus();
  const { data: stripeStatus, isLoading: stripeLoading } = useStripeStatus();
  const waveSync = useSyncWave();
  const stripeSync = useSyncStripe();

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect your financial tools to automatically sync transactions and data.
          </p>
        </div>

        {/* Blue Mogul Portal */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Blue Mogul Family</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-panel overflow-hidden border-primary/20">
              <div className="h-2 w-full bg-gradient-to-r from-primary to-accent" />
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Blue Mogul Portal
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1">
                    <Info className="w-3 h-3" /> Setup Required
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Sync invoicing, expenses, and client billing from the Blue Mogul Portal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <Key className="w-4 h-4 text-primary" /> How to connect
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Go to your Blue Mogul Portal settings</li>
                    <li>Navigate to API / Developer settings</li>
                    <li>Generate an API key</li>
                    <li>Add it as <code className="bg-muted px-1 rounded font-mono">BLUE_MOGUL_PORTAL_API_KEY</code> in environment variables</li>
                    <li>Add your portal URL as <code className="bg-muted px-1 rounded font-mono">BLUE_MOGUL_PORTAL_URL</code></li>
                  </ol>
                </div>
                <p className="text-xs text-muted-foreground">
                  Once connected, invoices and expenses from the Portal will automatically appear in Transactions and feed into your tax and P&L reports.
                </p>
                <Button variant="outline" className="w-full border-primary/20 text-primary hover:bg-primary/10" asChild>
                  <a href="#" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Open Blue Mogul Portal
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Accounting & Payments */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Accounting & Payments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wave Accounting */}
            <Card className="glass-panel overflow-hidden">
              <div className="h-2 w-full bg-gradient-to-r from-blue-400 to-blue-600" />
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Wave Accounting
                  {waveLoading ? null : <StatusBadge connected={!!waveStatus?.connected} />}
                </CardTitle>
                <CardDescription>Sync expenses, income, and chart of accounts from Wave.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {waveStatus?.lastSynced
                    ? `Last synced: ${format(new Date(waveStatus.lastSynced), "MMM d, h:mm a")}`
                    : waveStatus?.message || "Not connected"}
                </div>

                {!waveStatus?.connected && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">How to connect Wave:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to <a href="https://developer.waveapps.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">developer.waveapps.com</a></li>
                      <li>Create an app & get your API token</li>
                      <li>Add <code className="bg-muted px-1 rounded font-mono">WAVE_API_KEY</code> to environment secrets</li>
                    </ol>
                  </div>
                )}

                <Button
                  onClick={() => waveSync.mutate()}
                  disabled={waveSync.isPending || !waveStatus?.connected}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {waveSync.isPending
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
                    : <><RefreshCw className="w-4 h-4 mr-2" /> Sync Now</>}
                </Button>

                {waveSync.data && (
                  <p className={`text-xs text-center ${waveSync.data.success ? "text-success" : "text-destructive"}`}>
                    {waveSync.data.message}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Stripe */}
            <Card className="glass-panel overflow-hidden">
              <div className="h-2 w-full bg-gradient-to-r from-[#635BFF] to-[#8C85FF]" />
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Stripe Payments
                  {stripeLoading ? null : <StatusBadge connected={!!stripeStatus?.connected} />}
                </CardTitle>
                <CardDescription>Auto-import customer payments, fees, and refunds.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {stripeStatus?.lastSynced
                    ? `Last synced: ${format(new Date(stripeStatus.lastSynced), "MMM d, h:mm a")}`
                    : stripeStatus?.message || "Not connected"}
                </div>

                {!stripeStatus?.connected && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">How to connect Stripe:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Go to <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-primary underline">Stripe Dashboard → API Keys</a></li>
                      <li>Copy your Secret key</li>
                      <li>Add <code className="bg-muted px-1 rounded font-mono">STRIPE_SECRET_KEY</code> to environment secrets</li>
                    </ol>
                  </div>
                )}

                <Button
                  onClick={() => stripeSync.mutate()}
                  disabled={stripeSync.isPending || !stripeStatus?.connected}
                  className="w-full bg-[#635BFF] hover:bg-[#524be0] text-white"
                >
                  {stripeSync.isPending
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
                    : <><RefreshCw className="w-4 h-4 mr-2" /> Sync Now</>}
                </Button>

                {stripeSync.data && (
                  <p className={`text-xs text-center ${stripeSync.data.success ? "text-success" : "text-destructive"}`}>
                    {stripeSync.data.message}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Info section */}
        <Card className="glass-panel border-primary/10">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">How sync works</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When you sync an integration, new transactions are imported and auto-categorized. Existing transactions are never duplicated. 
                  All synced data flows into your Transactions, Budget tracking, Tax reports, and is available to Max (your AI assistant) 
                  for proactive analysis and insights.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
