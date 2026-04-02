import { useEffect } from "react";
import { useHealthCheck } from "../hooks/useHealthCheck";

export function HealthCheckReporter() {
  const { data, error } = useHealthCheck();

  useEffect(() => {
    if (data) {
      console.log("Health check:", data);
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      console.error("Health check failed:", error);
    }
  }, [error]);

  return null;
}
