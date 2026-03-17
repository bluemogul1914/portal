import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useReconciliationSessions, useCreateReconciliationSession, useCompleteReconciliationSession } from "@/hooks/use-reconciliation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, FileText, Plus } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";

export default function Reconciliation() {
  const { data: sessions, isLoading } = useReconciliationSessions();
  const createMut = useCreateReconciliationSession();
  const completeMut = useCompleteReconciliationSession();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  const onSubmit = async (data: any) => {
    await createMut.mutateAsync({
      data: {
        accountName: data.accountName,
        statementDate: data.statementDate,
        statementBalance: Number(data.statementBalance),
      }
    });
    setIsAddOpen(false);
    reset();
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Bank Reconciliation</h1>
            <p className="text-muted-foreground mt-1">Match your transactions against bank statements.</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl"><Plus className="w-4 h-4 mr-2"/> Start Session</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/10">
              <DialogHeader><DialogTitle>New Reconciliation Session</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input placeholder="E.g. Chase Business Checking" {...register("accountName", { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Statement Date</Label>
                  <Input type="date" {...register("statementDate", { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Ending Balance</Label>
                  <Input type="number" step="0.01" {...register("statementBalance", { required: true })} />
                </div>
                <Button type="submit" disabled={createMut.isPending} className="w-full">Create Session</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead>Account</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statement Bal</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10">Loading...</TableCell></TableRow>
                ) : sessions?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No sessions found.</TableCell></TableRow>
                ) : (
                  sessions?.map(session => (
                    <TableRow key={session.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="font-medium text-foreground">{session.accountName}</TableCell>
                      <TableCell>{format(new Date(session.statementDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(session.statementBalance)}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {session.difference != null ? formatCurrency(session.difference) : '-'}
                      </TableCell>
                      <TableCell>
                        {session.status === 'completed' ? (
                          <Badge variant="outline" className="border-success/30 text-success bg-success/10 gap-1"><CheckCircle2 className="w-3 h-3"/> Completed</Badge>
                        ) : (
                          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10 gap-1"><FileText className="w-3 h-3"/> In Progress</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {session.status === 'in_progress' && (
                          <Button size="sm" variant="secondary" onClick={() => completeMut.mutate({ id: session.id })} disabled={completeMut.isPending}>
                            Mark Complete
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
