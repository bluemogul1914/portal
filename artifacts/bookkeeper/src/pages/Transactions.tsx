import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useTransactions, useDeleteTransaction } from "@/hooks/use-transactions";
import { TransactionForm } from "@/components/TransactionForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Edit2, ShieldCheck, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import type { Transaction } from "@workspace/api-client-react";

export default function Transactions() {
  const { data: transactions, isLoading } = useTransactions();
  const deleteMut = useDeleteTransaction();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const filtered = transactions?.filter(tx => 
    tx.description.toLowerCase().includes(search.toLowerCase()) || 
    tx.category.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <Layout>
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Transactions</h1>
            <p className="text-muted-foreground mt-1">Manage and categorize your income and expenses.</p>
          </div>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 rounded-xl">
                <Plus className="w-4 h-4 mr-2" /> Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-card border-border/50">
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
              </DialogHeader>
              <TransactionForm onSuccess={() => setIsAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex gap-4 items-center bg-card/50">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search transactions..." 
                className="pl-9 bg-background/50 border-white/10 rounded-xl"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" className="rounded-xl border-white/10 hidden sm:flex">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
                ) : filtered?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No transactions found.</TableCell></TableRow>
                ) : (
                  filtered?.map(tx => (
                    <TableRow key={tx.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="font-medium text-muted-foreground">
                        {format(new Date(tx.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-foreground">{tx.description}</div>
                        {tx.source !== 'manual' && (
                          <span className="text-xs text-muted-foreground uppercase opacity-70 flex items-center gap-1 mt-0.5">
                            via {tx.source}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-secondary text-secondary-foreground border-white/5">
                          {tx.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tx.reconciled ? (
                          <Badge variant="outline" className="border-success/30 text-success bg-success/10 gap-1.5">
                            <ShieldCheck className="w-3 h-3" /> Reconciled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground bg-transparent">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${tx.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditingTx(tx)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => {
                            if(confirm("Are you sure you want to delete this transaction?")) {
                              deleteMut.mutate({ id: tx.id });
                            }
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Dialog open={!!editingTx} onOpenChange={(o) => !o && setEditingTx(null)}>
        <DialogContent className="sm:max-w-xl bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {editingTx && <TransactionForm initialData={editingTx} onSuccess={() => setEditingTx(null)} />}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
