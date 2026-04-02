import useSWR from "swr";
import { ApiError, apiRequest } from "../lib/api";

type HealthResponse = {
  status: string;
  time: string;
};

export function useHealthCheck() {
  return useSWR<HealthResponse, ApiError>("/health?from=react-app", apiRequest, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });
}
