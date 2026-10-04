import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { isNative } from "./platform/native";
import { announceUpdate } from "./ui/UpdateToast";

// The native app bundles its own files; only the web build needs a service worker.
if (!isNative && "serviceWorker" in navigator && import.meta.env.PROD) {
  void import("virtual:pwa-register").then(({ registerSW }) => {
    const update = registerSW({
      onNeedRefresh: () => announceUpdate(() => void update(true)),
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
