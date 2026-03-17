import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useBudgets, useBudgetSummary, useCreateBudget } from "@/hooks/use-budgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Target, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const budgetSchema = z.object({
  category: z.string().min(1, "Category required"),
  amount: z.coerce.number().positive("Must be positive"),
  year: z.coerce.number(),
  month: z.coerce.number().optional(),
});

function AddBudgetModal({ onSuccess }: { onSuccess: () => void }) {
  const createMut = useCreateBudget();
  const { register, handleSubmit } = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }
  });

  const onSubmit = async (data: z.infer<typeof budgetSchema>) => {
    await createMut.mutateAsync({ data });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Category</Label>
        <Input placeholder="E.g. Software, Office Supplies" {...register("category")} />
      </div>
      <div className="space-y-2">
        <Label>Monthly Amount</Label>
        <Input type="number" step="0.01" placeholder="0.00" {...register("amount")} />
      </div>
      <Button type="submit" disabled={createMut.isPending} className="w-full">
        Save Budget
      </Button>
    </form>
  );
}

export default function Budgets() {
  const [isOpen, setIsOpen] = useState(false);
  const now = new Date();
  const { data: summary, isLoading } = useBudgetSummary({ year: now.getFullYear(), month: now.getMonth() + 1 });

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Budgets</h1>
            <p className="text-muted-foreground mt-1">Track actual spending vs. planned budgets.</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl"><Plus className="w-4 h-4 mr-2"/> Set Budget</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/10">
              <DialogHeader><DialogTitle>Set Category Budget</DialogTitle></DialogHeader>
              <AddBudgetModal onSuccess={() => setIsOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-48 bg-secondary/50 rounded-2xl animate-pulse"/>)}
          </div>
        ) : !summary || summary.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-white/5 shadow-xl">
            <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-foreground">No budgets set</h3>
            <p className="text-muted-foreground mt-2 mb-6">Start tracking your spending by setting monthly category targets.</p>
            <Button onClick={() => setIsOpen(true)}>Create your first budget</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {summary.map((item, idx) => {
              const isOver = item.percentUsed > 100;
              const isWarning = item.percentUsed > 85 && !isOver;
              const progressColor = isOver ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary";
              
              return (
                <Card key={idx} className="glass-panel">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-center text-lg">
                      <span>{item.category}</span>
                      <TrendingUp className={`w-5 h-5 ${isOver ? 'text-destructive' : 'text-primary opacity-50'}`} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mt-2 space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="font-display font-bold text-2xl">
                          {formatCurrency(item.actual)}
                        </div>
                        <div className="text-sm text-muted-foreground mb-1">
                          of {formatCurrency(item.budgeted)}
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${progressColor} transition-all duration-500`} 
                            style={{ width: `${Math.min(item.percentUsed, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground font-medium">
                          <span>{item.percentUsed.toFixed(1)}% used</span>
                          <span className={isOver ? "text-destructive" : ""}>
                            {isOver ? `${formatCurrency(Math.abs(item.variance))} over` : `${formatCurrency(item.variance)} left`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
