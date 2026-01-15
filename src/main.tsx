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

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  createRoot(rootElement).render(<App />);
} catch (error) {
  console.error('Failed to render app:', error);
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial; color: red;">
      <h1>Erreur de chargement de l'application</h1>
      <p>${error instanceof Error ? error.message : String(error)}</p>
      <p>Vérifiez la console pour plus de détails.</p>
    </div>
  `;
}
