import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import App from "./App.tsx";
import { useHealthCheck } from "./hooks/useHealthCheck";
import "./index.css";

function HealthCheckReporter() {
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ shouldRetryOnError: false }}>
      <HealthCheckReporter />
      <App />
    </SWRConfig>
  </StrictMode>,
);
