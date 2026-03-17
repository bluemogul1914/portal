import { useDashboardStats, useInsights, useWaveOverdue } from "@/hooks/use-reports";
import { useWaveStatus, useStripeStatus } from "@/hooks/use-integrations";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  AlertCircle, ArrowUpRight, CheckCircle2, ExternalLink,
  RefreshCw, TrendingUp, TrendingDown,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
const fmtShort = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;

const CHART_COLORS = {
  inflow:  "hsl(213 94% 52%)",   // brand blue
  outflow: "hsl(215 20% 35%)",   // muted slate
  net:     "hsl(142 71% 45%)",   // green
  income:  "hsl(142 71% 45%)",
  expense: "hsl(0 72% 58%)",
  prev:    "hsl(215 20% 35%)",
  curr:    "hsl(213 94% 52%)",
};

const PIE_COLORS = [
  "hsl(213 94% 52%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 58%)",
  "hsl(199 89% 48%)",
  "hsl(0 72% 58%)",
];

function SectionHeader({ title, linkTo, linkLabel }: { title: string; linkTo?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-semibold text-sm text-foreground">{title}</h2>
      {linkTo && (
        <Link href={linkTo}>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary gap-1">
            {linkLabel || "View report"} <ExternalLink className="w-3 h-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium text-foreground">{fmtShort(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: insights, isLoading: insightsLoading } = useInsights();
  const { data: overdueData, isLoading: overdueLoading } = useWaveOverdue();
  const { data: waveStatus } = useWaveStatus();
  const { data: stripeStatus } = useStripeStatus();

  const isLoading = statsLoading || insightsLoading;

  return (
    <Layout>
      <div className="p-5 lg:p-7 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Insights for you</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Blue Mogul Enterprise, LLC</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">Live</span>
          </div>
        </div>

        {/* Row 1: Overdue Invoices + Cash Flow */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Overdue Invoices */}
          <Card className="glass-panel">
            <CardContent className="pt-4 pb-3 px-4">
              <SectionHeader title="Overdue invoices and bills" linkTo="/transactions" linkLabel="View all" />

              {/* Overdue invoices from Wave */}
              <div className="mb-3">
                <div className="flex items-center gap-2 text-xs font-medium text-destructive mb-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Overdue Invoices ({overdueLoading ? "…" : (overdueData?.invoices?.length || 0)})
                </div>
                <div className="space-y-1.5">
                  {overdueLoading ? (
                    [1,2,3].map(i => <Skeleton key={i} className="h-9 w-full rounded" />)
                  ) : overdueData?.invoices?.length ? (
                    overdueData.invoices.slice(0, 4).map(inv => {
                      const daysAgo = differenceInDays(new Date(), parseISO(inv.date));
                      return (
                        <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div>
                            <p className="text-xs font-medium text-foreground">{inv.customer}</p>
                            <p className="text-[10px] text-destructive/80">
                              Overdue {daysAgo} {daysAgo === 1 ? "day" : "days"} ago
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-foreground">{fmt(inv.amountDue)}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center gap-2 py-3 px-3 rounded-md bg-success/5 border border-success/20 text-xs text-success">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      You don't have any overdue invoices. Nice!
                    </div>
                  )}
                </div>
              </div>

              {/* Overdue Bills */}
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Overdue Bills
                </div>
                <div className="flex items-center gap-2 py-3 px-3 rounded-md bg-success/5 border border-success/20 text-xs text-success">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  You don't have any overdue bills. Nice!
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Flow Chart */}
          <Card className="glass-panel">
            <CardContent className="pt-4 pb-3 px-4">
              <SectionHeader title="Cash Flow" linkTo="/reports" />
              <div className="flex items-center gap-4 mb-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: CHART_COLORS.inflow }} />Inflow</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: CHART_COLORS.outflow }} />Outflow</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 inline-block" style={{ background: CHART_COLORS.net }} />Net change</span>
              </div>
              {insightsLoading ? (
                <Skeleton className="h-44 w-full rounded" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={insights?.monthlyData || []} barSize={10} margin={{ left: -20, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="inflow" fill={CHART_COLORS.inflow} radius={[2,2,0,0]} name="inflow" />
                    <Bar dataKey="outflow" fill={CHART_COLORS.outflow} radius={[2,2,0,0]} name="outflow" />
                    <Line type="monotone" dataKey="net" stroke={CHART_COLORS.net} strokeWidth={2} dot={false} name="net" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Connected Accounts + P&L */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Connected Accounts */}
          <Card className="glass-panel">
            <CardContent className="pt-4 pb-3 px-4">
              <SectionHeader title="Connected accounts" linkTo="/integrations" linkLabel="View all" />
              <div className="space-y-3">
                {/* Wave */}
                <div className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white">W</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">Wave Accounting</span>
                    </div>
                    {waveStatus?.connected ? (
                      <Badge variant="outline" className="text-[10px] h-5 bg-success/10 text-success border-success/20">Connected</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5 bg-muted text-muted-foreground">Not connected</Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Blue Mogul Enterprise, LLC</span>
                      <span className="text-foreground font-medium">Invoices synced</span>
                    </div>
                  </div>
                </div>

                {/* Stripe */}
                <div className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-[#635BFF] flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white">S</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">Stripe Payments</span>
                    </div>
                    {stripeStatus?.connected ? (
                      <Badge variant="outline" className="text-[10px] h-5 bg-success/10 text-success border-success/20">Connected</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-5 bg-muted text-muted-foreground">Not connected</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Sandbox mode</span>
                    <Link href="/integrations">
                      <button className="text-primary text-[10px] hover:underline flex items-center gap-0.5">
                        Sync <RefreshCw className="w-2.5 h-2.5" />
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Blue Mogul Portal */}
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white">BM</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">Blue Mogul Portal</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">Setup needed</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profit & Loss Chart */}
          <Card className="glass-panel">
            <CardContent className="pt-4 pb-3 px-4">
              <SectionHeader title="Profit and Loss" linkTo="/reports" />
              <div className="flex items-center gap-4 mb-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: CHART_COLORS.income }} />Income</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: CHART_COLORS.expense }} />Expenses</span>
              </div>
              {insightsLoading ? (
                <Skeleton className="h-44 w-full rounded" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={insights?.monthlyData || []} barSize={10} margin={{ left: -20, right: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="inflow" fill={CHART_COLORS.income} radius={[2,2,0,0]} name="income" />
                    <Bar dataKey="outflow" fill={CHART_COLORS.expense} radius={[2,2,0,0]} name="expenses" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Expenses Breakdown + Net Income */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Expenses Breakdown Donut */}
          <Card className="glass-panel">
            <CardContent className="pt-4 pb-3 px-4">
              <SectionHeader title="Expenses Breakdown" linkTo="/reports" />
              {insightsLoading ? (
                <Skeleton className="h-52 w-full rounded" />
              ) : !insights?.expenseCategories?.length ? (
                <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
                  <TrendingDown className="w-8 h-8 text-muted-foreground/50" />
                  <div>
                    <p className="text-sm font-medium text-foreground">No expense data yet</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      Add expenses in Transactions to see your breakdown here.
                    </p>
                  </div>
                  <Link href="/transactions">
                    <Button size="sm" variant="outline" className="text-xs h-7">Add Expense</Button>
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={190}>
                    <PieChart>
                      <Pie
                        data={insights.expenseCategories}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {insights.expenseCategories.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {insights.expenseCategories.map((cat, i) => {
                      const total = insights.expenseCategories.reduce((s, c) => s + c.value, 0);
                      const pct = total > 0 ? ((cat.value / total) * 100).toFixed(0) : "0";
                      return (
                        <div key={cat.name} className="flex items-center gap-2 text-[11px]">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-muted-foreground truncate flex-1">{pct}% {cat.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Net Income Year-over-Year */}
          <Card className="glass-panel">
            <CardContent className="pt-4 pb-3 px-4">
              <SectionHeader title="Net Income" />
              <p className="text-[10px] text-muted-foreground mb-3">Comparison by fiscal year</p>
              {insightsLoading ? (
                <Skeleton className="h-52 w-full rounded" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart
                      data={[
                        { name: String(insights?.netIncome?.previous?.year ?? "Prev"), value: insights?.netIncome?.previous?.net ?? 0 },
                        { name: String(insights?.netIncome?.current?.year ?? "Curr"),  value: insights?.netIncome?.current?.net ?? 0 },
                      ]}
                      barSize={48}
                      margin={{ left: -20, right: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="value" radius={[3,3,0,0]}>
                        <Cell fill={CHART_COLORS.prev} />
                        <Cell fill={CHART_COLORS.curr} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Table */}
                  <div className="mt-3 text-[11px]">
                    <div className="grid grid-cols-3 text-muted-foreground pb-1 border-b border-border font-medium">
                      <span></span>
                      <span className="text-right">{insights?.netIncome?.previous?.year}</span>
                      <span className="text-right">{insights?.netIncome?.current?.year}</span>
                    </div>
                    {[
                      { label: "Income",   prev: insights?.netIncome?.previous?.income ?? 0,   curr: insights?.netIncome?.current?.income ?? 0,   color: "text-success" },
                      { label: "Expense",  prev: insights?.netIncome?.previous?.expense ?? 0,  curr: insights?.netIncome?.current?.expense ?? 0,   color: "text-destructive" },
                      { label: "Net Income", prev: insights?.netIncome?.previous?.net ?? 0,    curr: insights?.netIncome?.current?.net ?? 0,       color: "text-foreground font-semibold" },
                    ].map(row => (
                      <div key={row.label} className={`grid grid-cols-3 py-1.5 border-b border-border/50 ${row.color}`}>
                        <span className="text-muted-foreground font-normal">{row.label}</span>
                        <span className="text-right">{fmt(row.prev)}</span>
                        <span className="text-right">{fmt(row.curr)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 4: Payable & Owing */}
        <Card className="glass-panel">
          <CardContent className="pt-4 pb-3 px-4">
            <SectionHeader title="Payable and owing" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Invoices payable to you */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Invoices payable to you</p>
                <div className="space-y-0">
                  {[
                    { label: "Coming due",       amount: 0 },
                    { label: "1-30 days overdue", amount: overdueData?.invoices?.filter(i => differenceInDays(new Date(), parseISO(i.date)) <= 30).reduce((s,i) => s+i.amountDue, 0) || 0 },
                    { label: "31-60 days overdue", amount: overdueData?.invoices?.filter(i => { const d = differenceInDays(new Date(), parseISO(i.date)); return d > 30 && d <= 60; }).reduce((s,i) => s+i.amountDue, 0) || 0 },
                    { label: "61-90 days overdue", amount: overdueData?.invoices?.filter(i => { const d = differenceInDays(new Date(), parseISO(i.date)); return d > 60 && d <= 90; }).reduce((s,i) => s+i.amountDue, 0) || 0 },
                    { label: "> 90 days overdue",  amount: overdueData?.invoices?.filter(i => differenceInDays(new Date(), parseISO(i.date)) > 90).reduce((s,i) => s+i.amountDue, 0) || 0 },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-1.5 border-b border-border/40 text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={row.amount > 0 ? "text-destructive font-medium" : "text-foreground"}>{fmt(row.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Bills you owe */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Bills you owe</p>
                <div className="space-y-0">
                  {[
                    { label: "Coming due", amount: 0 },
                    { label: "1-30 days overdue", amount: 0 },
                    { label: "31-60 days overdue", amount: 0 },
                    { label: "61-90 days overdue", amount: 0 },
                    { label: "> 90 days overdue", amount: stats ? (stats as any).outstandingTaxes || 0 : 0 },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-1.5 border-b border-border/40 text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={row.amount > 0 ? "text-destructive font-medium" : "text-foreground"}>{fmt(row.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
