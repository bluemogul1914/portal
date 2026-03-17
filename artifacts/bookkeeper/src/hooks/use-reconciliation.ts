import { useQueryClient } from "@tanstack/react-query";
import {
  useListReconciliationSessions as useGeneratedList,
  useCreateReconciliationSession as useGeneratedCreate,
  useCompleteReconciliationSession as useGeneratedComplete,
  getListReconciliationSessionsQueryKey,
} from "@workspace/api-client-react";

export function useReconciliationSessions() {
  return useGeneratedList();
}

export function useCreateReconciliationSession() {
  const queryClient = useQueryClient();
  return useGeneratedCreate({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListReconciliationSessionsQueryKey() }),
    },
  });
}

export function useCompleteReconciliationSession() {
  const queryClient = useQueryClient();
  return useGeneratedComplete({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListReconciliationSessionsQueryKey() }),
    },
  });
}
