import {
  useGetDashboardStats,
  useGetCashflowReport,
  useGetProfitLossReport,
} from "@workspace/api-client-react";

export function useDashboardStats() {
  return useGetDashboardStats();
}

export function useCashflowReport(params: Parameters<typeof useGetCashflowReport>[0]) {
  return useGetCashflowReport(params);
}

export function useProfitLossReport(params: Parameters<typeof useGetProfitLossReport>[0]) {
  return useGetProfitLossReport(params);
}
