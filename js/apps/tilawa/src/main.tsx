import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applySettings } from "./settings";
import "./app.css";

/** **الوضعُ يُطبَّق قبل أوّل رسم** — فلا يرى القارئ صفحةً بيضاءَ تنقلب داكنة */
applySettings();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
