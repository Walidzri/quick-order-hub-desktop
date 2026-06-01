import { FastifyInstance } from 'fastify';

const HTML = /* html */`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>🍳 Cuisine</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0f172a;
      color: #e2e8f0;
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      padding: 12px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 4px 16px;
    }
    h1 { font-size: 1.5rem; font-weight: 800; }
    #count { font-size: 0.9rem; color: #94a3b8; margin-top: 2px; }
    #ws-status {
      font-size: 0.75rem; font-weight: 600;
      padding: 4px 12px; border-radius: 999px;
    }
    .connected    { background: #166534; color: #bbf7d0; }
    .disconnected { background: #7f1d1d; color: #fecaca; }
    #grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .card {
      background: #1e293b;
      border-radius: 14px;
      padding: 16px;
      border-left: 6px solid #3b82f6;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: border-color 0.3s;
    }
    .card.warning { border-left-color: #f59e0b; }
    .card.urgent  { border-left-color: #ef4444; animation: pulse 2s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.85; }
    }
    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .order-num { font-size: 2rem; font-weight: 900; line-height: 1; color: #f1f5f9; }
    .badges { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .badge {
      font-size: 0.65rem; font-weight: 700;
      padding: 3px 8px; border-radius: 999px;
      text-transform: uppercase; letter-spacing: 0.05em;
      white-space: nowrap;
    }
    .badge-dine-in   { background: #4c1d95; color: #ddd6fe; }
    .badge-takeaway  { background: #0c4a6e; color: #bae6fd; }
    .badge-delivery  { background: #78350f; color: #fde68a; }
    .timer { font-size: 0.85rem; font-weight: 600; color: #94a3b8; }
    .timer.warning { color: #fbbf24; }
    .timer.urgent  { color: #f87171; }
    .items { list-style: none; display: flex; flex-direction: column; gap: 6px; }
    .item {
      padding: 5px 0;
      border-bottom: 1px solid #ffffff0f;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .item:last-child { border-bottom: none; }
    .qty { font-weight: 800; min-width: 26px; color: #60a5fa; font-size: 1rem; }
    .item-body { flex: 1; }
    .item-name { font-size: 0.95rem; font-weight: 600; }
    .item-variant { font-size: 0.78rem; color: #94a3b8; }
    .modifiers { font-size: 0.75rem; color: #7dd3fc; margin-top: 2px; }
    .item-note { font-size: 0.75rem; color: #fcd34d; margin-top: 2px; }
    .delivery-note {
      font-size: 0.8rem;
      background: #451a0322;
      border: 1px solid #78350f44;
      border-radius: 8px;
      padding: 8px 10px;
      color: #fde68a;
    }
    .btn-ready {
      width: 100%;
      padding: 16px;
      font-size: 1.1rem;
      font-weight: 800;
      background: #15803d;
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .btn-ready:hover  { background: #166534; }
    .btn-ready:active { background: #14532d; transform: scale(0.98); }
    .btn-ready:disabled { background: #1e3a2e; color: #4b7a5a; cursor: not-allowed; }
    .empty {
      grid-column: 1 / -1;
      text-align: center;
      color: #334155;
      font-size: 1.5rem;
      padding: 80px 20px;
      user-select: none;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>🍳 Cuisine</h1>
      <div id="count">Chargement…</div>
    </div>
    <span id="ws-status" class="disconnected">⬤ Déconnecté</span>
  </header>
  <div id="grid"></div>

  <script>
    const KITCHEN_STATUSES = ['sentToKitchen'];
    let orders = {};
    let ws = null;

    // ── Utils ─────────────────────────────────────────────────────────────────
    const TYPE_LABEL  = { 'dine-in': 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' };
    const TYPE_BADGE  = { 'dine-in': 'badge-dine-in', takeaway: 'badge-takeaway', delivery: 'badge-delivery' };

    function elapsed(createdAt) {
      const ms = Date.now() - new Date(createdAt).getTime();
      const m  = Math.floor(ms / 60000);
      const s  = Math.floor((ms % 60000) / 1000);
      return m > 0 ? m + 'min ' + s + 's' : s + 's';
    }

    function urgencyClass(createdAt) {
      const m = (Date.now() - new Date(createdAt).getTime()) / 60000;
      if (m > 10) return 'urgent';
      if (m > 5)  return 'warning';
      return '';
    }

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Rendu ─────────────────────────────────────────────────────────────────
    function renderOrders() {
      const grid = document.getElementById('grid');
      const list = Object.values(orders).sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
      );

      const n = list.length;
      document.getElementById('count').textContent =
        n === 0 ? 'Aucune commande en attente'
        : n === 1 ? '1 commande en attente'
        : n + ' commandes en attente';

      if (n === 0) {
        grid.innerHTML = '<div class="empty">✅ Pas de commande en attente</div>';
        return;
      }

      grid.innerHTML = list.map(o => {
        const urgency = urgencyClass(o.createdAt);
        const timerClass = urgency === 'urgent' ? 'urgent' : urgency === 'warning' ? 'warning' : '';

        const itemsHtml = (o.lines || []).map(l => {
          const mods = (l.modifiers || []).map(m => esc(m.optionName)).join(', ');
          return '<li class="item">'
            + '<span class="qty">\xD7' + l.quantity + '</span>'
            + '<div class="item-body">'
            + '<div class="item-name">' + esc(l.productName) + '</div>'
            + (l.variantSize ? '<div class="item-variant">' + esc(l.variantSize) + '</div>' : '')
            + (mods ? '<div class="modifiers">+ ' + mods + '</div>' : '')
            + (l.note ? '<div class="item-note">\uD83D\uDCDD ' + esc(l.note) + '</div>' : '')
            + '</div></li>';
        }).join('');

        const deliveryNote = o.type === 'delivery' && (o.deliveryCustomerName || o.deliveryAddress)
          ? '<div class="delivery-note">\uD83D\uDEF5 '
            + [o.deliveryCustomerName, o.deliveryPhone, o.deliveryAddress]
              .filter(Boolean).map(esc).join(' — ')
            + '</div>'
          : '';

        return '<div class="card ' + urgency + '" id="card-' + o.id + '">'
          + '<div class="card-header">'
          + '<div class="order-num">N\xB0' + esc(o.orderNumber || '\u2014') + '</div>'
          + '<div class="badges">'
          + '<span class="badge ' + (TYPE_BADGE[o.type] || '') + '">' + esc(TYPE_LABEL[o.type] || o.type) + '</span>'
          + '<span class="timer ' + timerClass + '" id="timer-' + o.id + '">' + elapsed(o.createdAt) + '</span>'
          + '</div></div>'
          + '<ul class="items">' + itemsHtml + '</ul>'
          + deliveryNote
          + '<button class="btn-ready" data-id="' + o.id + '">\u2713 Pr\xEAt</button>'
          + '</div>';
      }).join('');
    }

    // ── Mise à jour des timers ────────────────────────────────────────────────
    setInterval(() => {
      for (const o of Object.values(orders)) {
        const timerEl = document.getElementById('timer-' + o.id);
        const cardEl  = document.getElementById('card-' + o.id);
        if (timerEl) {
          const urg = urgencyClass(o.createdAt);
          timerEl.textContent = elapsed(o.createdAt);
          timerEl.className   = 'timer ' + (urg === 'urgent' ? 'urgent' : urg === 'warning' ? 'warning' : '');
          if (cardEl) cardEl.className = 'card ' + urg;
        }
      }
    }, 10000);

    // ── Action "Prêt" ─────────────────────────────────────────────────────────
    async function markReady(id, btn) {
      if (btn) { btn.disabled = true; btn.textContent = '\u23F3'; }
      try {
        const res = await fetch('/api/orders/' + id + '/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ready' }),
        });
        if (res.ok) {
          delete orders[id];
          renderOrders();
        } else {
          throw new Error('Erreur ' + res.status);
        }
      } catch (e) {
        console.error(e);
        if (btn) { btn.disabled = false; btn.textContent = '\u2713 Pr\xEAt'; }
      }
    }

    // Event delegation — un seul listener pour tous les boutons "Prêt"
    document.getElementById('grid').addEventListener('click', function(e) {
      const btn = e.target.closest('.btn-ready');
      if (btn && !btn.disabled) {
        markReady(btn.getAttribute('data-id'), btn);
      }
    });

    // ── Chargement initial ────────────────────────────────────────────────────
    async function loadOrders() {
      try {
        const data = await fetch('/api/orders').then(r => r.json());
        const list = data.orders || data;
        orders = {};
        for (const o of list) {
          if (KITCHEN_STATUSES.includes(o.status)) orders[o.id] = o;
        }
        renderOrders();
      } catch (e) {
        console.error('Erreur chargement commandes', e);
        document.getElementById('count').textContent = 'Erreur de connexion';
      }
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────
    function connect() {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(proto + '//' + location.host + '/ws/events');

      ws.onopen = () => {
        const el = document.getElementById('ws-status');
        el.textContent = '\u25CF Connecté';
        el.className = 'connected';
      };

      ws.onclose = () => {
        const el = document.getElementById('ws-status');
        el.textContent = '\u25CF Déconnecté';
        el.className = 'disconnected';
        setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);

          if (type === 'order:created') {
            if (KITCHEN_STATUSES.includes(payload.status)) {
              orders[payload.id] = payload;
              renderOrders();
              playBeep();
            }
          } else if (type === 'order:status') {
            if (KITCHEN_STATUSES.includes(payload.status)) {
              orders[payload.id] = payload.order;
              renderOrders();
              playBeep();
            } else if (payload.status === 'ready' || payload.status === 'cancelled') {
              if (orders[payload.id]) {
                delete orders[payload.id];
                renderOrders();
              }
            }
            // 'paid' et autres statuts ne retirent PAS la commande de la cuisine
            // (commande comptoir : payée immédiatement mais le cuisinier doit quand même la préparer)
          }
        } catch {}
      };
    }

    // ── Son d'alerte ──────────────────────────────────────────────────────────
    function playBeep() {
      try {
        const ctx  = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } catch {}
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    loadOrders();
    connect();
  </script>
</body>
</html>`;

import { settingsService } from '../services/settingsService';

export async function cuisineRoutes(fastify: FastifyInstance) {
  fastify.get('/cuisine', async (_request, reply) => {
    const settings = settingsService.get();
    if (settings.cuisineEnabled === false) {
      return reply.status(503).type('text/html').send(
        '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:4rem;background:#0f172a;color:#94a3b8"><h1>🍳 Tablette cuisine désactivée</h1><p>Ce service est désactivé dans les paramètres du POS.</p></body></html>'
      );
    }
    reply.type('text/html').send(HTML);
  });
}
