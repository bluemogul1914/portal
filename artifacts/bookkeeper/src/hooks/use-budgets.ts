import { useQueryClient } from "@tanstack/react-query";
import {
  useListBudgets as useGeneratedList,
  useGetBudgetSummary as useGeneratedSummary,
  useCreateBudget as useGeneratedCreate,
  useUpdateBudget as useGeneratedUpdate,
  useDeleteBudget as useGeneratedDelete,
  getListBudgetsQueryKey,
  getGetBudgetSummaryQueryKey,
} from "@workspace/api-client-react";

export function useBudgets(params: Parameters<typeof useGeneratedList>[0] = {}) {
  return useGeneratedList(params);
}

export function useBudgetSummary(params: Parameters<typeof useGeneratedSummary>[0]) {
  return useGeneratedSummary(params);
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useGeneratedCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }) });
      },
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useGeneratedUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }) });
      },
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useGeneratedDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBudgetSummaryQueryKey({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }) });
      },
    },
  });
}
