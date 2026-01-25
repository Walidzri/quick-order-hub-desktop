import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { logger } from "./lib/logger";

// Handler global pour les erreurs JavaScript non capturées
window.addEventListener('error', (event) => {
  logger.error(
    'Uncaught JavaScript error',
    event.error || new Error(event.message),
    'GlobalErrorHandler',
    {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    }
  );
});

// Handler global pour les promesses rejetées non gérées
window.addEventListener('unhandledrejection', (event) => {
  logger.error(
    'Unhandled promise rejection',
    event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    'GlobalErrorHandler',
    {
      reason: event.reason,
    }
  );
});

// Logger le démarrage de l'application (déféré pour éviter les erreurs au chargement)
setTimeout(() => {
  try {
    logger.info('Application starting', 'App');
  } catch (error) {
    console.error('Failed to log application start:', error);
  }
}, 100);

// Test du système de logging (déféré)
setTimeout(() => {
  try {
    logger.info('Logger test - INFO level', 'Test');
    logger.warn('Logger test - WARN level', 'Test');
    logger.error('Logger test - ERROR level', new Error('Test error'), 'Test');
    
    // Vérifier que les logs sont sauvegardés (seulement en dev)
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const isElectron = !!window.electronAPI;
      if (isElectron) {
        console.log('✅ [Logger] Logs are being saved to files in Electron mode');
      } else {
        try {
          if (logger && typeof logger.getLocalStorageLogs === 'function') {
            const savedLogs = logger.getLocalStorageLogs();
            console.log(`✅ [Logger] ${savedLogs.length} logs saved to localStorage (browser mode)`);
            console.log('📁 [Logger] To view logs:', 'logger.getLocalStorageLogs()');
            console.log('📄 [Logger] To export logs:', 'logger.exportLocalStorageLogs()');
          }
        } catch (error) {
          console.warn('[Logger] Could not check localStorage logs:', error);
        }
      }
    }
  } catch (error) {
    console.error('Failed to run logger tests:', error);
  }
}, 2000);

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
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (error) {
  logger.fatal('Failed to render app', error instanceof Error ? error : new Error(String(error)), 'main.tsx');
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: Arial; color: red;">
      <h1>Erreur de chargement de l'application</h1>
      <p>${error instanceof Error ? error.message : String(error)}</p>
      <p>Vérifiez la console pour plus de détails.</p>
    </div>
  `;
}
