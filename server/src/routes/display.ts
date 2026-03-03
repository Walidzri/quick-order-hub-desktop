import { FastifyInstance } from 'fastify';

const HTML = /* html */`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Affichage salle</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0f172a;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }

    /* ── Header ────────────────────────────────────────────────────────────── */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 32px;
      background: #1e293b;
      border-bottom: 2px solid #334155;
      flex-shrink: 0;
    }
    #restaurant-name {
      font-size: 1.4rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #f1f5f9;
    }
    #clock {
      font-size: 1.6rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #94a3b8;
    }
    #ws-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: #ef4444;
      transition: background 0.3s;
    }
    #ws-dot.connected { background: #22c55e; }

    /* ── Main ──────────────────────────────────────────────────────────────── */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 24px 32px 16px;
      gap: 24px;
      overflow: hidden;
    }

    /* ── Section prêtes ────────────────────────────────────────────────────── */
    .section-ready {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
    }
    .section-label {
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .section-label.ready   { color: #4ade80; }
    .section-label.preparing { color: #94a3b8; }

    #ready-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-content: flex-start;
      overflow: hidden;
    }

    .order-chip {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 16px;
      font-weight: 900;
      letter-spacing: 0.02em;
      animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes popIn {
      from { transform: scale(0.5); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }
    .chip-ready {
      background: #14532d;
      border: 3px solid #22c55e;
      color: #bbf7d0;
      font-size: clamp(1.8rem, 4vw, 3.5rem);
      padding: clamp(12px, 2vw, 20px) clamp(20px, 3vw, 36px);
      min-width: clamp(100px, 12vw, 160px);
    }

    /* ── Divider ────────────────────────────────────────────────────────────── */
    .divider {
      height: 1px;
      background: #1e293b;
      flex-shrink: 0;
    }

    /* ── Section en préparation ─────────────────────────────────────────────── */
    .section-preparing {
      flex-shrink: 0;
    }
    #preparing-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }
    .chip-preparing {
      background: #1e293b;
      border: 2px solid #334155;
      color: #64748b;
      font-size: clamp(1rem, 2vw, 1.4rem);
      padding: 8px 18px;
      border-radius: 10px;
    }

    /* ── État vide ──────────────────────────────────────────────────────────── */
    .empty-ready {
      font-size: clamp(1.2rem, 3vw, 2rem);
      color: #1e293b;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <header>
    <div id="restaurant-name">Quick Order Hub</div>
    <div id="clock"></div>
    <div id="ws-dot"></div>
  </header>

  <main>
    <div class="section-ready">
      <div class="section-label ready">✅ Commandes prêtes</div>
      <div id="ready-grid">
        <div class="empty-ready">Aucune commande prête</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="section-preparing">
      <div class="section-label preparing">⏳ En préparation</div>
      <div id="preparing-list"></div>
    </div>
  </main>

  <script>
    const READY_STATUS  = 'ready';
    const PREP_STATUSES = ['sentToKitchen'];

    let readyOrders     = {};  // id → order
    let preparingOrders = {};  // id → order
    let ws = null;

    // ── Horloge ───────────────────────────────────────────────────────────────
    function updateClock() {
      document.getElementById('clock').textContent =
        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    updateClock();
    setInterval(updateClock, 10000);

    // ── Rendu ─────────────────────────────────────────────────────────────────
    function renderReady() {
      const grid  = document.getElementById('ready-grid');
      const list  = Object.values(readyOrders);

      if (list.length === 0) {
        grid.innerHTML = '<div class="empty-ready">Aucune commande prête</div>';
        return;
      }

      grid.innerHTML = list
        .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))
        .map(o =>
          '<div class="order-chip chip-ready">N\xB0' + esc(o.orderNumber || o.id.slice(-4)) + '</div>'
        ).join('');
    }

    function renderPreparing() {
      const el   = document.getElementById('preparing-list');
      const list = Object.values(preparingOrders);

      el.innerHTML = list.length === 0
        ? ''
        : list
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .map(o =>
              '<div class="order-chip chip-preparing">N\xB0' + esc(o.orderNumber || o.id.slice(-4)) + '</div>'
            ).join('');
    }

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── Appliquer un event d'ordre ─────────────────────────────────────────────
    function applyOrder(order) {
      const { id, status } = order;

      if (status === READY_STATUS) {
        // Toujours afficher dans "Prêtes", même si déjà payé (comptoir)
        delete preparingOrders[id];
        readyOrders[id] = order;
        renderReady();
        renderPreparing();

      } else if (PREP_STATUSES.includes(status)) {
        preparingOrders[id] = order;
        delete readyOrders[id];
        renderReady();
        renderPreparing();

      } else if (status === 'paid') {
        // Retirer de "Prêtes" si la commande y était (client vient chercher sa commande)
        // NE PAS retirer de "En préparation" : commande comptoir payée
        // immédiatement mais cuisinier prépare encore
        if (readyOrders[id]) {
          delete readyOrders[id];
          renderReady();
        }

      } else if (status === 'cancelled') {
        delete readyOrders[id];
        delete preparingOrders[id];
        renderReady();
        renderPreparing();
      }
    }

    // ── Chargement initial ────────────────────────────────────────────────────
    async function loadOrders() {
      try {
        const [settingsRes, ordersRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/orders'),
        ]);

        // Nom du restaurant
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          if (s.restaurantName) {
            document.getElementById('restaurant-name').textContent = s.restaurantName;
          }
        }

        // Commandes actives
        if (ordersRes.ok) {
          const data = await ordersRes.json();
          const list = data.orders || data;
          readyOrders     = {};
          preparingOrders = {};
          for (const o of list) {
            if (o.status === READY_STATUS)             readyOrders[o.id]    = o;
            else if (PREP_STATUSES.includes(o.status)) preparingOrders[o.id] = o;
          }
          renderReady();
          renderPreparing();
        }
      } catch (e) {
        console.error('Erreur chargement', e);
      }
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────
    function connect() {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(proto + '//' + location.host + '/ws/events');

      ws.onopen = () => {
        document.getElementById('ws-dot').className = 'connected';
      };

      ws.onclose = () => {
        document.getElementById('ws-dot').className = '';
        setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          if (type === 'order:created') {
            applyOrder(payload);
          } else if (type === 'order:status') {
            applyOrder({ ...payload.order, status: payload.status });
          }
        } catch {}
      };
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    loadOrders();
    connect();
  </script>
</body>
</html>`;

export async function displayRoutes(fastify: FastifyInstance) {
  fastify.get('/display', async (_request, reply) => {
    reply.type('text/html').send(HTML);
  });
}
