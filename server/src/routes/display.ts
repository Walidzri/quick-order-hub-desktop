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
    /* ── Thème clair ─────────────────────────────────────────────────────────── */
    body.light { background: #f8fafc; color: #0f172a; }
    body.light header { background: #ffffff; border-bottom-color: #e2e8f0; }
    body.light #restaurant-name { color: #0f172a; }
    body.light #clock { color: #64748b; }
    body.light .section-label.ready { color: #16a34a; }
    body.light .section-label.preparing { color: #64748b; }
    body.light .chip-ready { background: #dcfce7; border-color: #22c55e; color: #15803d; }
    body.light .chip-preparing { background: #f1f5f9; border-color: #cbd5e1; color: #94a3b8; }
    body.light .divider { background: #e2e8f0; }
    body.light .empty-ready { color: #cbd5e1; }
    #theme-btn {
      background: none; border: none; font-size: 1.2rem;
      cursor: pointer; padding: 4px; line-height: 1; opacity: 0.6;
    }
    #theme-btn:hover { opacity: 1; }

    /* ── Overlay activation son ─────────────────────────────────────────────── */
    #audio-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.85);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 24px; cursor: pointer;
    }
    #audio-overlay .icon { font-size: 5rem; }
    #audio-overlay .msg {
      font-size: clamp(1.4rem, 3vw, 2.2rem);
      font-weight: 700; color: #f1f5f9; text-align: center;
    }
    #audio-overlay .sub {
      font-size: clamp(0.9rem, 1.5vw, 1.2rem);
      color: #94a3b8; text-align: center;
    }
  </style>
</head>
<body>
  <div id="audio-overlay" onclick="activateAudio()">
    <div class="icon">🔊</div>
    <div class="msg">Appuyer pour activer le son</div>
    <div class="sub">Requis par le navigateur</div>
  </div>

  <header>
    <div style="display:flex;align-items:center;gap:12px;">
      <img id="header-logo" alt="" style="height:48px;width:auto;object-fit:contain;display:none;border-radius:6px;" />
      <div id="restaurant-name">Quick Order Hub</div>
    </div>
    <div id="clock"></div>
    <div style="display:flex;align-items:center;gap:10px;">
      <button id="theme-btn" onclick="toggleTheme()" title="Changer le th\xE8me">\uD83C\uDF19</button>
      <div id="ws-dot"></div>
    </div>
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
    const READY_STATUS       = 'ready';
    const READY_DISPLAY_MS   = 5 * 60 * 1000; // 5 min sur l'affichage salle

    let readyOrders     = {};  // id → order
    let preparingOrders = {};  // id → order
    let ws = null;

    // ── Thème ─────────────────────────────────────────────────────────────────
    (function initTheme() {
      const saved = localStorage.getItem('display-theme');
      if (saved === 'light') {
        document.body.classList.add('light');
        document.getElementById('theme-btn').textContent = '\u2600\uFE0F';
      }
    })();

    function toggleTheme() {
      const isLight = document.body.classList.toggle('light');
      localStorage.setItem('display-theme', isLight ? 'light' : 'dark');
      document.getElementById('theme-btn').textContent = isLight ? '\u2600\uFE0F' : '\uD83C\uDF19';
    }

    // ── Date du jour (pour filtre et reset minuit) ────────────────────────────
    function todayStart() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }

    // Reset automatique à minuit
    let currentDay = new Date().toDateString();
    setInterval(() => {
      const today = new Date().toDateString();
      if (today !== currentDay) {
        currentDay = today;
        readyOrders = {};
        preparingOrders = {};
        loadOrders();
      }
    }, 60000);

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

    // ── Auto-suppression des commandes "prêtes" après READY_DISPLAY_MS ──────────
    function scheduleReadyRemoval(id, delayMs) {
      setTimeout(() => {
        if (readyOrders[id]) {
          delete readyOrders[id];
          renderReady();
        }
      }, delayMs);
    }

    // ── Annonce vocale avec file d'attente ───────────────────────────────────
    let speechQueue = [];
    let isSpeaking  = false;
    let cachedVoice = null;

    function getFrenchFemaleVoice() {
      if (cachedVoice) return cachedVoice;
      const voices   = speechSynthesis.getVoices();
      const frVoices = voices.filter(v => v.lang.startsWith('fr'));
      const feminine = ['Julie', 'Amélie', 'Audrey', 'Virginie', 'Marie', 'Zoé',
                        'Google français', 'Microsoft Julie'];
      cachedVoice = frVoices.find(v => feminine.some(n => v.name.includes(n))) ?? frVoices[0] ?? null;
      return cachedVoice;
    }

    function processQueue() {
      if (isSpeaking || speechQueue.length === 0) return;
      isSpeaking = true;
      const utt  = speechQueue.shift();
      utt.onend  = () => { isSpeaking = false; processQueue(); };
      utt.onerror = () => { isSpeaking = false; processQueue(); };
      speechSynthesis.speak(utt);
    }

    function announce(orderNumber) {
      if (!window.speechSynthesis || !audioUnlocked) return;

      // parseInt transforme "0042" en 42 → le synthé dit "quarante-deux" et non "zéro zéro quarante-deux"
      const num = parseInt(orderNumber, 10) || orderNumber;

      function enqueue() {
        const utt   = new SpeechSynthesisUtterance('Commande numéro ' + num + ', prête !');
        utt.lang    = 'fr-FR';
        utt.rate    = 0.88;
        utt.pitch   = 1.15;
        const voice = getFrenchFemaleVoice();
        if (voice) utt.voice = voice;
        speechQueue.push(utt);
        processQueue();
      }

      if (speechSynthesis.getVoices().length > 0) {
        enqueue();
      } else {
        speechSynthesis.addEventListener('voiceschanged', enqueue, { once: true });
      }
    }

    // ── Appliquer un event d'ordre ─────────────────────────────────────────────
    function applyOrder(order) {
      const { id, status } = order;
      const kitchenDone = !!order.kitchenReadyAt;

      if (kitchenDone && preparingOrders[id]) {
        // Cuisine terminée — kitchenReadyAt est le signal, qu'elle soit paid ou ready
        delete preparingOrders[id];
        readyOrders[id] = order;
        renderReady();
        renderPreparing();
        scheduleReadyRemoval(id, READY_DISPLAY_MS);
        announce(order.orderNumber || id.slice(-4));

      } else if (order.sentToKitchenAt && !kitchenDone && status !== 'cancelled') {
        preparingOrders[id] = order;
        delete readyOrders[id];
        renderReady();
        renderPreparing();

      } else if (status === 'paid' && readyOrders[id]) {
        // Commande payée après avoir été prête → client servi, retirer de l'affichage
        delete readyOrders[id];
        renderReady();

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
          fetch('/api/orders?start=' + encodeURIComponent(todayStart())),
        ]);

        // Nom du restaurant + logo
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          if (s.restaurantName) {
            document.getElementById('restaurant-name').textContent = s.restaurantName;
          }
          if (s.logo) {
            const img = document.getElementById('header-logo');
            img.src = s.logo;
            img.style.display = 'block';
          }
        }

        // Commandes actives
        if (ordersRes.ok) {
          const data = await ordersRes.json();
          const list = data.orders || data;
          readyOrders     = {};
          preparingOrders = {};
          for (const o of list) {
            const kitchenDone = !!o.kitchenReadyAt;
            if (kitchenDone) {
              // Cuisine terminée (paid ou ready) — afficher si encore récent
              const readyAt   = o.kitchenReadyAt || o.updatedAt;
              const age       = Date.now() - new Date(readyAt).getTime();
              const remaining = READY_DISPLAY_MS - age;
              if (remaining > 0) {
                readyOrders[o.id] = o;
                scheduleReadyRemoval(o.id, remaining);
              }
            } else if (o.sentToKitchenAt && !kitchenDone && o.status !== 'cancelled') {
              preparingOrders[o.id] = o;
            }
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
          } else if (type === 'kitchen:purged') {
            readyOrders = {};
            preparingOrders = {};
            loadOrders();
          }
        } catch {}
      };
    }

    // ── Activation audio (requis par la politique autoplay des navigateurs) ───
    let audioUnlocked = false;

    function activateAudio() {
      if (audioUnlocked) return;
      audioUnlocked = true;
      document.getElementById('audio-overlay').style.display = 'none';
      // Jouer un silence pour débloquer le contexte audio
      const utt = new SpeechSynthesisUtterance('');
      utt.volume = 0;
      speechSynthesis.speak(utt);
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    loadOrders();
    connect();
  </script>
</body>
</html>`;

import { settingsService } from '../services/settingsService';

export async function displayRoutes(fastify: FastifyInstance) {
  fastify.get('/display', async (_request, reply) => {
    const settings = settingsService.get();
    if (settings.displayEnabled === false) {
      return reply.status(503).type('text/html').send(
        '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:4rem;background:#0f172a;color:#94a3b8"><h1>📺 Télé salle désactivée</h1><p>Ce service est désactivé dans les paramètres du POS.</p></body></html>'
      );
    }
    reply.type('text/html').send(HTML);
  });
}
