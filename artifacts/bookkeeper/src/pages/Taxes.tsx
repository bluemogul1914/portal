import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useTaxItems, useTaxSummary, useCreateTaxItem } from "@/hooks/use-taxes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Building2, Percent, CheckCircle2, Clock } from "lucide-react";

export default function Taxes() {
  const currentYear = new Date().getFullYear();
  const { data: taxItems, isLoading: loadingItems } = useTaxItems({ year: currentYear });
  const { data: summary, isLoading: loadingSummary } = useTaxSummary({ year: currentYear });

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Tax Management</h1>
            <p className="text-muted-foreground mt-1">Year {currentYear} estimated taxes and deductions tracking.</p>
          </div>
        </div>

        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="bg-card border border-white/5 rounded-xl p-1 mb-6">
            <TabsTrigger value="summary" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Year-End Summary</TabsTrigger>
            <TabsTrigger value="quarterly" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Quarterly Estimates</TabsTrigger>
            <TabsTrigger value="deductions" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Top Deductions</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            {!summary ? <div className="h-64 bg-secondary/50 rounded-2xl animate-pulse" /> : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                  <Card className="glass-panel bg-gradient-to-br from-card to-card/50">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-success">{formatCurrency(summary.totalRevenue)}</div></CardContent>
                  </Card>
                  <Card className="glass-panel">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{formatCurrency(summary.totalExpenses)}</div></CardContent>
                  </Card>
                  <Card className="glass-panel">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tax Deductions</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(summary.totalDeductions)}</div></CardContent>
                  </Card>
                  <Card className="glass-panel border-primary/30">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-primary">Est. Taxable Income</CardTitle></CardHeader>
                    <CardContent><div className="text-3xl font-display font-bold text-foreground">{formatCurrency(summary.taxableIncome)}</div></CardContent>
                  </Card>
                </div>
                
                <Card className="glass-panel bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      Tax Preparation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-muted-foreground">Sales Tax Collected</span>
                      <span className="font-mono font-bold">{formatCurrency(summary.salesTaxCollected)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-muted-foreground">Est. Taxes Paid</span>
                      <span className="font-mono font-bold text-success">{formatCurrency(summary.estimatedTaxPaid)}</span>
                    </div>
                    <Button className="w-full mt-4" variant="secondary">Generate Tax Report</Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="quarterly" className="space-y-4">
             <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-4">Estimated Quarterly Payments</h3>
                <div className="space-y-3">
                  {summary?.quarterBreakdown.map(q => (
                    <div key={q.quarter} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-background border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">Q{q.quarter}</div>
                        <div>
                          <div className="font-semibold">Quarter {q.quarter} Estimate</div>
                          <div className="text-sm text-muted-foreground">Net Income: {formatCurrency(q.netIncome)}</div>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-0 flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Est. Tax Due</div>
                          <div className="font-mono font-bold text-lg">{formatCurrency(q.estimatedTaxDue)}</div>
                        </div>
                        <Button variant="outline" size="sm">Record Payment</Button>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </TabsContent>

          <TabsContent value="deductions">
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Percent className="w-5 h-5 text-primary"/> Top Deductible Categories</h3>
              <div className="space-y-2">
                {summary?.topDeductions.map((d, i) => (
                  <div key={i} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-lg transition-colors">
                    <span className="font-medium">{d.category}</span>
                    <span className="font-mono font-bold">{formatCurrency(d.amount)}</span>
                  </div>
                ))}
                {summary?.topDeductions.length === 0 && <p className="text-muted-foreground">No deductions recorded yet.</p>}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
