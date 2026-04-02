import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import App from "./App.tsx";
import { HealthCheckReporter } from "./components/HealthCheckReporter";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SWRConfig value={{ shouldRetryOnError: false }}>
      <HealthCheckReporter />
      <App />
    </SWRConfig>
  </StrictMode>,
);
