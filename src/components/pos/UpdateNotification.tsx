import { useState, useEffect, useRef } from "react";

const API = "http://localhost:3002";

type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  releaseNotes: string | null;
  progress: number;
  error: string | null;
}

export default function UpdateNotification() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll update status every 2s when an action is in progress
  useEffect(() => {
    // Initial check
    fetchStatus();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch(`${API}/api/update/status`);
      if (res.ok) {
        const data: UpdateState = await res.json();
        setState(data);

        // Start polling if downloading, stop if idle/done
        if (data.status === "downloading" || data.status === "checking") {
          startPolling();
        } else {
          stopPolling();
        }
      }
    } catch {
      // Server not ready yet
    }
  }

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(fetchStatus, 2000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function handleDownload() {
    await fetch(`${API}/api/update/download`, { method: "POST" });
    setDismissed(false);
    startPolling();
    fetchStatus();
  }

  async function handleInstall() {
    await fetch(`${API}/api/update/install`, { method: "POST" });
  }

  const status = state?.status ?? "idle";

  // Don't show if idle, checking, dismissed, or no state
  if (!state || status === "idle" || status === "checking" || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm">
      <div className="rounded-xl bg-white shadow-2xl ring-1 ring-black/10 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {status === "available" && "Mise à jour disponible"}
                {status === "downloading" && "Téléchargement en cours..."}
                {status === "downloaded" && "Mise à jour prête"}
                {status === "error" && "Erreur de mise à jour"}
              </p>
              {state.availableVersion && (
                <p className="text-xs text-neutral-500">
                  v{state.currentVersion} → v{state.availableVersion}
                </p>
              )}
            </div>
          </div>
          {status !== "downloading" && (
            <button
              onClick={() => setDismissed(true)}
              className="text-neutral-400 hover:text-neutral-600 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress bar */}
        {status === "downloading" && (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500 text-right">{state.progress}%</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {status === "available" && (
            <>
              <button
                onClick={handleDownload}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-500"
              >
                Télécharger
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 transition"
              >
                Plus tard
              </button>
            </>
          )}
          {status === "downloaded" && (
            <>
              <button
                onClick={handleInstall}
                className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow transition hover:bg-green-500"
              >
                Installer et redémarrer
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 transition"
              >
                Au prochain lancement
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
