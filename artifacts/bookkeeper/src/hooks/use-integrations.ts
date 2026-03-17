import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWaveStatus,
  useGetStripeStatus,
  useSyncWaveData as useGeneratedSyncWave,
  useSyncStripeData as useGeneratedSyncStripe,
  getGetWaveStatusQueryKey,
  getGetStripeStatusQueryKey,
} from "@workspace/api-client-react";

export function useWaveStatus() {
  return useGetWaveStatus();
}

export function useStripeStatus() {
  return useGetStripeStatus();
}

export function useSyncWave() {
  const queryClient = useQueryClient();
  return useGeneratedSyncWave({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() }),
    },
  });
}

export function useSyncStripe() {
  const queryClient = useQueryClient();
  return useGeneratedSyncStripe({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetStripeStatusQueryKey() }),
    },
  });
}
