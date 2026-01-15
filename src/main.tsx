import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Debug: Check if electronAPI is available (development only)
const isDev = import.meta.env.DEV;
if (isDev && typeof window !== 'undefined') {
  console.log('Window object:', window);
  console.log('electronAPI available:', typeof window.electronAPI !== 'undefined');
  if (window.electronAPI) {
    console.log('electronAPI methods:', Object.keys(window.electronAPI));
  }
}

createRoot(document.getElementById("root")!).render(<App />);
