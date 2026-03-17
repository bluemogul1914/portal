import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardStats,
  useGetCashflowReport,
  useGetProfitLossReport,
} from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useDashboardStats() {
  return useGetDashboardStats();
}

export function useCashflowReport(params: Parameters<typeof useGetCashflowReport>[0]) {
  return useGetCashflowReport(params);
}

export function useProfitLossReport(params: Parameters<typeof useGetProfitLossReport>[0]) {
  return useGetProfitLossReport(params);
}

export function useInsights() {
  return useQuery({
    queryKey: ["reports", "insights"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/reports/insights`);
      if (!res.ok) throw new Error("Failed to load insights");
      return res.json() as Promise<{
        monthlyData: { month: string; inflow: number; outflow: number; net: number }[];
        expenseCategories: { name: string; value: number }[];
        netIncome: {
          previous: { year: number; income: number; expense: number; net: number };
          current:  { year: number; income: number; expense: number; net: number };
        };
      }>;
    },
    staleTime: 60_000,
  });
}

export function useWaveOverdue() {
  return useQuery({
    queryKey: ["wave", "overdue"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/wave/overdue`);
      if (!res.ok) return { invoices: [] };
      return res.json() as Promise<{
        invoices: { id: string; invoiceNumber: string; date: string; customer: string; total: number; amountDue: number }[];
      }>;
    },
    staleTime: 120_000,
  });
}
