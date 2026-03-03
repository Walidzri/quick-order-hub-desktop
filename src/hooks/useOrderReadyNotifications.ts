import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

/**
 * Connecte un WebSocket à /ws/events et affiche une notification toast
 * chaque fois qu'une commande passe au statut "ready" (marquée prête en cuisine).
 * Se reconnecte automatiquement si la connexion est perdue.
 */
export function useOrderReadyNotifications() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      const ws = new WebSocket('ws://127.0.0.1:3002/ws/events');
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          if (type === 'order:status' && payload.status === 'ready') {
            const num = payload.order?.orderNumber || payload.id?.slice(-4) || '?';
            toast({
              title: '🔔 Commande prête !',
              description: `La commande N°${num} est prête à être récupérée.`,
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!destroyed) {
          retryRef.current = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);
}
