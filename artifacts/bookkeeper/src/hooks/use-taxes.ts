import { useQueryClient } from "@tanstack/react-query";
import {
  useListTaxItems as useGeneratedList,
  useGetTaxSummary as useGeneratedSummary,
  useCreateTaxItem as useGeneratedCreate,
  useUpdateTaxItem as useGeneratedUpdate,
  useDeleteTaxItem as useGeneratedDelete,
  getListTaxItemsQueryKey,
  getGetTaxSummaryQueryKey,
} from "@workspace/api-client-react";

export function useTaxItems(params: Parameters<typeof useGeneratedList>[0] = {}) {
  return useGeneratedList(params);
}

export function useTaxSummary(params: Parameters<typeof useGeneratedSummary>[0]) {
  return useGeneratedSummary(params);
}

export function useCreateTaxItem() {
  const queryClient = useQueryClient();
  return useGeneratedCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTaxItemsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTaxSummaryQueryKey({ year: new Date().getFullYear() }) });
      },
    },
  });
}

export function useUpdateTaxItem() {
  const queryClient = useQueryClient();
  return useGeneratedUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTaxItemsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTaxSummaryQueryKey({ year: new Date().getFullYear() }) });
      },
    },
  });
}

export function useDeleteTaxItem() {
  const queryClient = useQueryClient();
  return useGeneratedDelete({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTaxItemsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTaxSummaryQueryKey({ year: new Date().getFullYear() }) });
      },
    },
  });
}
