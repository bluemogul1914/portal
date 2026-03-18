import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWaveStatus,
  useSyncWaveData as useGeneratedSyncWave,
  getGetWaveStatusQueryKey,
} from "@workspace/api-client-react";

export function useWaveStatus() {
  return useGetWaveStatus();
}

export function useSyncWave() {
  const queryClient = useQueryClient();
  return useGeneratedSyncWave({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWaveStatusQueryKey() }),
    },
  });
}
