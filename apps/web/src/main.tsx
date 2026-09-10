import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ContentProvider } from "./lib/content";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ContentProvider>
      <App />
    </ContentProvider>
  </StrictMode>,
);
