import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RootProviders } from "@/app-providers";
import "./index.css";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootProviders />
  </StrictMode>,
)
