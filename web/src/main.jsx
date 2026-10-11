import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";
createRoot(document.getElementById("root")).render(<App />);
// Offline support: a service worker on this same origin caches the app, guides, catalogue and postcode files you use.
if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
