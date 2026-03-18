import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type Vendor = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  postalCode: string | null;
  currency: string | null;
  displayId: string | null;
  source: string;
  sourceId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function useVendors(search?: string) {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return useQuery<Vendor[]>({
    queryKey: ["vendors", search],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/vendors${params}`);
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Vendor>) => {
      const res = await fetch(`${BASE}/api/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create vendor");
      return res.json() as Promise<Vendor>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Vendor> & { id: number }) => {
      const res = await fetch(`${BASE}/api/vendors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update vendor");
      return res.json() as Promise<Vendor>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/vendors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete vendor");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}

export function useSyncWaveVendors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/wave/vendors/sync`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to sync vendors");
      return res.json() as Promise<{ success: boolean; imported: number; updated: number; message: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendors"] }),
  });
}
