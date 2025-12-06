import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[PeachHaus] Starting app...");

const rootElement = document.getElementById("root");
if (rootElement) {
  console.log("[PeachHaus] Root element found, mounting React app...");
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log("[PeachHaus] React app mounted");
} else {
  console.error("[PeachHaus] Root element not found!");
}
