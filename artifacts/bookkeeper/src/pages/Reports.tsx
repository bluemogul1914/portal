import { Layout } from "@/components/Layout";
import { useCashflowReport } from "@/hooks/use-reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subMonths } from "date-fns";

export default function Reports() {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = subMonths(new Date(), 6).toISOString().split('T')[0];
  
  const { data: cashflow, isLoading } = useCashflowReport({ startDate, endDate });

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics for the last 6 months.</p>
        </div>

        {isLoading || !cashflow ? (
          <div className="h-[400px] w-full bg-secondary/50 rounded-2xl animate-pulse" />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="glass-panel border-l-4 border-l-success">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Inflow</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-display font-bold text-success">{formatCurrency(cashflow.totalInflow)}</div></CardContent>
              </Card>
              <Card className="glass-panel border-l-4 border-l-destructive">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Outflow</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-display font-bold text-destructive">{formatCurrency(cashflow.totalOutflow)}</div></CardContent>
              </Card>
              <Card className="glass-panel border-l-4 border-l-primary">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Net Cash Flow</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-display font-bold text-foreground">{formatCurrency(cashflow.netCashflow)}</div></CardContent>
              </Card>
            </div>

            <Card className="glass-panel">
              <CardHeader>
                <CardTitle>Cash Flow Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashflow.byMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.5)" tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#0B1120', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="inflow" name="Income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="outflow" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
