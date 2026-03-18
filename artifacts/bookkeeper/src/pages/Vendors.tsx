import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor, useSyncWaveVendors, type Vendor } from "@/hooks/use-vendors";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Globe, Mail, Phone, Plus, RefreshCw,
  Search, Trash2, Edit2, MapPin, AlertTriangle,
} from "lucide-react";

const empty: Partial<Vendor> = {
  name: "", email: "", phone: "", mobile: "", website: "",
  addressLine1: "", city: "", province: "", country: "United States", postalCode: "", currency: "USD", notes: "",
};

export default function Vendors() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [form, setForm] = useState<Partial<Vendor>>(empty);
  const [editing, setEditing] = useState<number | null>(null);

  const { data: vendors = [], isLoading } = useVendors(search || undefined);
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();
  const syncWave = useSyncWaveVendors();
  const { toast } = useToast();

  const openCreate = () => { setForm(empty); setEditing(null); setOpen(true); };
  const openEdit = (v: Vendor) => { setForm(v); setEditing(v.id); setOpen(true); };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (editing) {
      await updateVendor.mutateAsync({ id: editing, ...form });
      toast({ title: "Vendor updated" });
    } else {
      await createVendor.mutateAsync(form);
      toast({ title: "Vendor created" });
    }
    setOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteVendor.mutateAsync(deleteTarget.id);
    toast({ title: `${deleteTarget.name} deleted` });
    setDeleteTarget(null);
  };

  const handleSync = async () => {
    const result = await syncWave.mutateAsync();
    toast({
      title: result.success ? "Wave Sync Complete" : "Sync Failed",
      description: result.message,
      variant: result.success ? "default" : "destructive",
    });
  };

  return (
    <Layout>
      <div className="p-5 lg:p-7 space-y-5 max-w-5xl mx-auto animate-in fade-in duration-300">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Vendors</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage suppliers and service providers</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncWave.isPending}
              className="gap-2 h-8 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncWave.isPending ? "animate-spin" : ""}`} />
              Sync from Wave
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-2 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* Wave bills notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/80 leading-relaxed">
            <span className="font-semibold text-amber-400">Wave API Note:</span> Wave's public API exposes vendor contacts but not bills or purchase transactions. Your 3 Wave vendors are synced here. To import purchase history, connect Relay Financial via Plaid or enter purchases manually in the{" "}
            <a href="/purchases" className="underline underline-offset-2 text-amber-400 hover:text-amber-300">Purchases</a> page.
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/30"
          />
        </div>

        {/* Vendor cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : !vendors.length ? (
          <Card className="glass-panel">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Building2 className="w-10 h-10 text-muted-foreground/40" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No vendors yet</p>
                <p className="text-xs text-muted-foreground mt-1">Sync from Wave or add a vendor manually.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSync} disabled={syncWave.isPending} className="gap-1.5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Wave vendors
                </Button>
                <Button size="sm" onClick={openCreate} className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  Add manually
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vendors.map(v => (
              <Card key={v.id} className="glass-panel hover:border-primary/30 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-4.5 h-4.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-snug">{v.name}</p>
                        {v.displayId && <p className="text-[10px] text-muted-foreground">{v.displayId}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(v)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(v)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {v.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3 h-3 shrink-0" />
                        <a href={`mailto:${v.email}`} className="hover:text-foreground truncate">{v.email}</a>
                      </div>
                    )}
                    {(v.phone || v.mobile) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{v.phone || v.mobile}</span>
                      </div>
                    )}
                    {v.website && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="w-3 h-3 shrink-0" />
                        <a href={v.website.startsWith("http") ? v.website : `https://${v.website}`} target="_blank" rel="noreferrer" className="hover:text-foreground truncate">{v.website}</a>
                      </div>
                    )}
                    {(v.city || v.country) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{[v.city, v.province, v.country].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/50">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {v.currency || "USD"}
                    </Badge>
                    {v.source === "wave" && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20">
                        Wave
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Company Name *</Label>
              <Input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Flixon Distribution" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@vendor.com" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone || ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Website</Label>
              <Input value={form.website || ""} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://vendor.com" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Currency</Label>
              <Input value={form.currency || "USD"} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="USD" className="h-8 text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Address</Label>
              <Input value={form.addressLine1 || ""} onChange={e => setForm(f => ({ ...f, addressLine1: e.target.value }))} placeholder="Street address" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">City</Label>
              <Input value={form.city || ""} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Atlanta" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">State / Province</Label>
              <Input value={form.province || ""} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} placeholder="Georgia" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Country</Label>
              <Input value={form.country || ""} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="United States" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Postal Code</Label>
              <Input value={form.postalCode || ""} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="30301" className="h-8 text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Payment terms, account number, etc." className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={createVendor.isPending || updateVendor.isPending}>
              {editing ? "Save Changes" : "Create Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently remove the vendor from your records.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteVendor.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
