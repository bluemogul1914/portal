import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVendors } from "@/hooks/use-vendors";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Plus, Search, ShoppingCart, Building2, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PURCHASE_CATEGORIES = [
  "Cost of Goods Sold",
  "Software & Subscriptions",
  "Professional Services",
  "Office Supplies",
  "Payroll",
  "Marketing & Advertising",
  "Insurance",
  "Utilities",
  "Rent & Lease",
  "Travel & Meals",
  "Equipment",
  "Other Expenses",
];

type Purchase = {
  id: number;
  date: string;
  description: string;
  amount: string;
  category: string;
  source: string;
  notes: string | null;
  createdAt: string;
};

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  vendorName: "",
  amount: "",
  category: "Cost of Goods Sold",
  notes: "",
};

export default function Purchases() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: vendors = [] } = useVendors();
  const { toast } = useToast();

  const loadPurchases = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/transactions?type=expense`);
      if (res.ok) {
        const data = await res.json();
        setPurchases(data.transactions || data || []);
      }
    } catch {}
    setIsLoading(false);
    setLoaded(true);
  };

  if (!loaded && !isLoading) loadPurchases();

  const filtered = purchases.filter(p =>
    !search || p.description.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalSpend = filtered.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);

  const handleSave = async () => {
    if (!form.description.trim()) { toast({ title: "Description required", variant: "destructive" }); return; }
    if (!form.amount || isNaN(Number(form.amount))) { toast({ title: "Valid amount required", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const desc = form.vendorName ? `${form.vendorName} — ${form.description}` : form.description;
      const res = await fetch(`${BASE}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          description: desc,
          amount: form.amount,
          type: "expense",
          category: form.category,
          taxDeductible: true,
          notes: form.notes || null,
          source: "manual",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Purchase recorded" });
      setOpen(false);
      setForm(emptyForm);
      await loadPurchases();
    } catch {
      toast({ title: "Failed to save purchase", variant: "destructive" });
    }
    setSaving(false);
  };

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  return (
    <Layout>
      <div className="p-5 lg:p-7 space-y-5 max-w-5xl mx-auto animate-in fade-in duration-300">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Purchases</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track vendor bills and business expenses</p>
          </div>
          <Button size="sm" onClick={() => { setForm(emptyForm); setOpen(true); }} className="gap-2 h-8 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Record Purchase
          </Button>
        </div>

        {/* Wave notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/80 leading-relaxed">
            <span className="font-semibold text-amber-400">Wave API Limitation:</span> Wave's public API does not expose bills or purchase transactions — only invoices and vendor contacts. Record purchases manually below, or connect Relay Financial via Plaid to auto-import your bank transactions as expenses.
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Spend", value: fmt(totalSpend), icon: DollarSign, color: "text-destructive" },
            { label: "Transactions", value: String(filtered.length), icon: ShoppingCart, color: "text-foreground" },
            { label: "Vendors", value: String(vendors.length), icon: Building2, color: "text-primary" },
          ].map(s => (
            <Card key={s.label} className="glass-panel">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-muted/50 flex items-center justify-center">
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search purchases by description or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/30"
          />
        </div>

        {/* Purchases list */}
        <Card className="glass-panel">
          <CardContent className="p-0">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-border text-[11px] font-medium text-muted-foreground">
              <span className="col-span-2">Date</span>
              <span className="col-span-5">Description</span>
              <span className="col-span-3">Category</span>
              <span className="col-span-2 text-right">Amount</span>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !filtered.length ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <ShoppingCart className="w-9 h-9 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">No purchases recorded</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "Record Purchase" to add your first vendor bill.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map(p => (
                  <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/20 transition-colors items-center">
                    <div className="col-span-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 shrink-0" />
                      {format(new Date(p.date), "MMM d, yyyy")}
                    </div>
                    <div className="col-span-5">
                      <p className="text-xs font-medium text-foreground leading-snug">{p.description}</p>
                    </div>
                    <div className="col-span-3">
                      <Badge variant="outline" className="text-[10px] h-5 font-normal">{p.category}</Badge>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-semibold text-destructive">{fmt(parseFloat(p.amount))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Record Purchase Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Purchase</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount ($) *</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="h-8 text-sm" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Vendor</Label>
              <Select value={form.vendorName} onValueChange={v => setForm(f => ({ ...f, vendorName: v === "_none" ? "" : v }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select vendor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No specific vendor</SelectItem>
                  {vendors.map(v => (
                    <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Monthly distribution fee, software license…" className="h-8 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Invoice #, PO number, etc." className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Record Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
