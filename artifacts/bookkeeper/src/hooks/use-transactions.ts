import { useQueryClient } from "@tanstack/react-query";
import {
  useListTransactions as useGeneratedList,
  useCreateTransaction as useGeneratedCreate,
  useUpdateTransaction as useGeneratedUpdate,
  useDeleteTransaction as useGeneratedDelete,
  useReconcileTransaction as useGeneratedReconcile,
  getListTransactionsQueryKey,
  getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";

export function useTransactions(params: Parameters<typeof useGeneratedList>[0] = {}) {
  return useGeneratedList(params);
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useGeneratedCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      },
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useGeneratedUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      },
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useGeneratedDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      },
    },
  });
}

export function useReconcileTransaction() {
  const queryClient = useQueryClient();
  return useGeneratedReconcile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      },
    },
  });
}
