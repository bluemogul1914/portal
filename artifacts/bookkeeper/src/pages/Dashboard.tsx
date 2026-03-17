import { useDashboardStats } from "@/hooks/use-reports";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, DollarSign, Calculator, Scale, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useDashboardStats();

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (isError || !stats) {
    return (
      <Layout>
        <div className="p-8 text-center text-muted-foreground">Failed to load dashboard data.</div>
      </Layout>
    );
  }

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Financial Overview</h1>
            <p className="text-muted-foreground mt-1">Here's your current cash flow and business performance.</p>
          </div>
          <div className="flex items-center gap-2 bg-secondary px-4 py-2 rounded-xl text-sm font-medium border border-border/50 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
            Books are up to date
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="glass-panel overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <DollarSign className="w-16 h-16 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Monthly Net Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">
                {formatCurrency(stats.currentMonthNet)}
              </div>
              <div className="mt-2 flex items-center text-sm">
                <Badge variant={stats.currentMonthNet >= 0 ? "default" : "destructive"} className="bg-opacity-20 text-success border-success/20">
                  {stats.currentMonthNet >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                  {stats.currentMonthNet >= 0 ? "+" : ""}{formatCurrency(stats.currentMonthRevenue)} Rev
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-16 h-16 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">YTD Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-success">
                {formatCurrency(stats.ytdRevenue)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">vs {formatCurrency(stats.ytdExpenses)} Exp</p>
            </CardContent>
          </Card>

          <Card className="glass-panel relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Scale className="w-16 h-16 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-foreground">
                {formatCurrency(stats.cashBalance)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">{stats.unreconciledCount} items to reconcile</p>
            </CardContent>
          </Card>

          <Card className="glass-panel relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Calculator className="w-16 h-16 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Taxes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-destructive">
                {formatCurrency(stats.outstandingTaxes)}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {stats.upcomingTaxDates.length > 0 ? `Next due: ${format(new Date(stats.upcomingTaxDates[0].dueDate || ''), 'MMM d, yyyy')}` : "All clear"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="glass-panel h-full">
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.recentTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No recent transactions.</div>
                  ) : (
                    stats.recentTransactions.slice(0, 5).map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors border border-white/5">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'income' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                            {tx.type === 'income' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{tx.description}</p>
                            <p className="text-sm text-muted-foreground">{tx.category} • {format(new Date(tx.date), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className={`font-bold font-mono ${tx.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card className="glass-panel h-full">
              <CardHeader>
                <CardTitle>Upcoming Deadlines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.upcomingTaxDates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No upcoming tax deadlines!</div>
                  ) : (
                    stats.upcomingTaxDates.slice(0, 4).map(tax => (
                      <div key={tax.id} className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 capitalize">
                            {tax.type.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm font-medium text-muted-foreground">
                            {tax.dueDate ? format(new Date(tax.dueDate), 'MMM d') : 'No date'}
                          </span>
                        </div>
                        <p className="font-semibold text-foreground">{tax.description}</p>
                        <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(tax.amount)}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
