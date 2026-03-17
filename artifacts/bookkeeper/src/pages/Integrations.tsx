import { Layout } from "@/components/Layout";
import { useWaveStatus, useStripeStatus, useSyncWave, useSyncStripe } from "@/hooks/use-integrations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function Integrations() {
  const { data: waveStatus, isLoading: waveLoading } = useWaveStatus();
  const { data: stripeStatus, isLoading: stripeLoading } = useStripeStatus();
  const waveSync = useSyncWave();
  const stripeSync = useSyncStripe();

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect your tools to automatically sync transactions.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Wave Accounting Card */}
          <Card className="glass-panel overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-blue-400 to-blue-600"></div>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                Wave Accounting
                {waveLoading ? null : waveStatus?.connected ? (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1"><CheckCircle2 className="w-3 h-3"/> Connected</Badge>
                ) : (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><XCircle className="w-3 h-3"/> Disconnected</Badge>
                )}
              </CardTitle>
              <CardDescription>Sync expenses, income, and chart of accounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {waveStatus?.lastSynced ? `Last synced: ${format(new Date(waveStatus.lastSynced), 'MMM d, h:mm a')}` : "Never synced"}
              </div>
              <Button 
                onClick={() => waveSync.mutate()} 
                disabled={waveSync.isPending || !waveStatus?.connected} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {waveSync.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {waveSync.isPending ? "Syncing..." : "Sync Now"}
              </Button>
            </CardContent>
          </Card>

          {/* Stripe Card */}
          <Card className="glass-panel overflow-hidden">
            <div className="h-2 w-full bg-gradient-to-r from-[#635BFF] to-[#8C85FF]"></div>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                Stripe Payments
                {stripeLoading ? null : stripeStatus?.connected ? (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1"><CheckCircle2 className="w-3 h-3"/> Connected</Badge>
                ) : (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><XCircle className="w-3 h-3"/> Disconnected</Badge>
                )}
              </CardTitle>
              <CardDescription>Auto-import customer payments and fees.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {stripeStatus?.lastSynced ? `Last synced: ${format(new Date(stripeStatus.lastSynced), 'MMM d, h:mm a')}` : "Never synced"}
              </div>
              <Button 
                onClick={() => stripeSync.mutate()} 
                disabled={stripeSync.isPending || !stripeStatus?.connected} 
                className="w-full bg-[#635BFF] hover:bg-[#524be0] text-white"
              >
                {stripeSync.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {stripeSync.isPending ? "Syncing..." : "Sync Now"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
