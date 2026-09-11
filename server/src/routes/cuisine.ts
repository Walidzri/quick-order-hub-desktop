import { FastifyInstance } from 'fastify';

const HTML = /* html */`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Cuisine</title>
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
      flex-wrap: wrap;
      gap: 8px;
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
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    #history-grid {
      display: flex;
      flex-direction: column;
    }
    .masonry-col {
      flex: 1;
      min-width: 280px;
      display: flex;
      flex-direction: column;
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
      cursor: pointer;
      transition: border-color 0.3s, transform 0.15s, box-shadow 0.15s;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 4px 20px #0006; }
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
    .badge-web       { background: #065f46; color: #6ee7b7; }
    .web-customer    { font-size: 0.8rem; background: #06554022; border: 1px solid #06554044; border-radius: 8px; padding: 8px 10px; color: #6ee7b7; }
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
    .composition { font-size: 0.8rem; color: #f97316; font-weight: 700; margin-top: 2px; }
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
    .web-actions { display: flex; gap: 8px; }
    .btn-accept {
      flex: 1; padding: 16px; font-size: 1.1rem; font-weight: 800;
      background: #15803d; color: white; border: none; border-radius: 10px;
      cursor: pointer; transition: background 0.15s, transform 0.1s;
      letter-spacing: 0.05em; text-transform: uppercase;
    }
    .btn-accept:hover  { background: #166534; }
    .btn-accept:active { background: #14532d; transform: scale(0.98); }
    .btn-accept:disabled { background: #1e3a2e; color: #4b7a5a; cursor: not-allowed; }
    .btn-reject {
      flex: 1; padding: 16px; font-size: 1.1rem; font-weight: 800;
      background: #991b1b; color: white; border: none; border-radius: 10px;
      cursor: pointer; transition: background 0.15s, transform 0.1s;
      letter-spacing: 0.05em; text-transform: uppercase;
    }
    .btn-reject:hover  { background: #7f1d1d; }
    .btn-reject:active { background: #450a0a; transform: scale(0.98); }
    .btn-reject:disabled { background: #3b1111; color: #7a4b4b; cursor: not-allowed; }
    .reject-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    .reject-panel {
      background: #1a1a1a; border-radius: 16px; padding: 24px; width: 90%; max-width: 420px;
      border: 1px solid #333;
    }
    .reject-panel h3 { color: #fff; font-size: 1.2rem; margin: 0 0 16px; text-align: center; }
    .reject-reasons { display: flex; flex-direction: column; gap: 10px; }
    .reject-reason-btn {
      padding: 14px 20px; font-size: 1rem; font-weight: 700; color: white;
      background: #991b1b; border: none; border-radius: 10px; cursor: pointer;
      transition: background 0.15s, transform 0.1s; text-align: left;
    }
    .reject-reason-btn:hover { background: #7f1d1d; }
    .reject-reason-btn:active { background: #450a0a; transform: scale(0.98); }
    .reject-reason-btn:disabled { background: #3b1111; color: #7a4b4b; cursor: not-allowed; }
    .reject-cancel-btn {
      margin-top: 12px; width: 100%; padding: 12px; font-size: 0.95rem; font-weight: 600;
      color: #aaa; background: transparent; border: 1px solid #444; border-radius: 10px;
      cursor: pointer; transition: background 0.15s;
    }
    .reject-cancel-btn:hover { background: #222; color: #fff; }
    .card.web-pending { border-left-color: #10b981; }
    .ico { display: inline-block; width: 1em; height: 1em; vertical-align: -0.15em; fill: currentColor; flex-shrink: 0; }
    .ico-sm { width: 0.85em; height: 0.85em; }
    .ico-lg { width: 1.2em; height: 1.2em; vertical-align: -0.2em; }
    .tab { position: relative; }
    .web-count-badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: white; font-size: 0.65rem; font-weight: 800;
      min-width: 18px; height: 18px; line-height: 18px; text-align: center;
      padding: 0 5px; border-radius: 999px;
      animation: pulse 1.5s infinite;
    }
    .empty {
      width: 100%;
      text-align: center;
      color: #334155;
      font-size: 1.5rem;
      padding: 80px 20px;
      user-select: none;
    }
    .tabs { display: flex; gap: 8px; }
    .tab {
      padding: 8px 20px;
      border-radius: 8px;
      border: none;
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      background: #1e293b;
      color: #64748b;
      transition: background 0.2s, color 0.2s;
    }
    .tab.active { background: #3b82f6; color: #fff; }
    .card-total {
      font-size: 0.9rem;
      font-weight: 700;
      color: #94a3b8;
      text-align: right;
      border-top: 1px solid #ffffff10;
      padding-top: 8px;
    }
    .card.done { border-left-color: #22c55e; opacity: 0.7; }
    /* ── Focus overlay ───────────────────────────────────────────────────── */
    .focus-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .focus-card {
      background: #1e293b;
      border-radius: 18px;
      padding: 24px;
      width: 100%;
      max-width: 500px;
      max-height: 85vh;
      overflow-y: auto;
      border-left: 8px solid #3b82f6;
      animation: scaleIn 0.2s ease;
      position: relative;
    }
    @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .focus-card.warning { border-left-color: #f59e0b; }
    .focus-card.urgent  { border-left-color: #ef4444; }
    .focus-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: #334155;
      border: none;
      color: #e2e8f0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 1.2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .focus-close:hover { background: #475569; }
    .focus-header { margin-bottom: 16px; }
    .focus-num { font-size: 2.5rem; font-weight: 900; color: #f1f5f9; }
    .focus-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .focus-meta-item {
      font-size: 0.8rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: #334155;
      color: #cbd5e1;
    }
    .focus-meta-item.timer-badge { background: #1e3a5f; color: #93c5fd; }
    .focus-meta-item.timer-badge.warning { background: #451a03; color: #fbbf24; }
    .focus-meta-item.timer-badge.urgent { background: #450a0a; color: #f87171; }
    .focus-items { margin-top: 16px; }
    .focus-items .item { padding: 10px 0; border-bottom: 1px solid #ffffff10; }
    .focus-items .item:last-child { border-bottom: none; }
    .focus-items .qty { font-size: 1.1rem; min-width: 32px; }
    .focus-items .item-name { font-size: 1.05rem; }
    .focus-delivery {
      margin-top: 16px;
      background: #451a0333;
      border: 1px solid #78350f55;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .focus-delivery-title { font-size: 0.75rem; font-weight: 700; color: #fde68a; margin-bottom: 6px; text-transform: uppercase; }
    .focus-delivery-row { font-size: 0.85rem; color: #fef3c7; margin-top: 4px; }
    .focus-total {
      font-size: 1.2rem;
      font-weight: 800;
      color: #94a3b8;
      text-align: right;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #ffffff15;
    }
    .focus-btn-ready {
      width: 100%;
      padding: 18px;
      font-size: 1.2rem;
      font-weight: 800;
      background: #15803d;
      color: white;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      margin-top: 16px;
      transition: background 0.15s, transform 0.1s;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .focus-btn-ready:hover { background: #166534; }
    .focus-btn-ready:active { background: #14532d; transform: scale(0.98); }
    body.light .focus-overlay { background: rgba(0,0,0,0.5); }
    body.light .focus-card { background: #ffffff; border-color: #e2e8f0; }
    body.light .focus-card .focus-num { color: #0f172a; }
    body.light .focus-close { background: #e2e8f0; color: #0f172a; }
    body.light .focus-close:hover { background: #cbd5e1; }
    body.light .focus-meta-item { background: #f1f5f9; color: #475569; }
    body.light .focus-meta-item.timer-badge { background: #dbeafe; color: #1d4ed8; }
    body.light .focus-meta-item.timer-badge.warning { background: #fef3c7; color: #92400e; }
    body.light .focus-meta-item.timer-badge.urgent { background: #fee2e2; color: #991b1b; }
    body.light .focus-total { color: #475569; border-top-color: #e2e8f0; }
    body.light .focus-items .item { border-bottom-color: #e2e8f020; }
    body.light .focus-card .composition { color: #c2410c; }
    body.light .focus-card .item-note { color: #92400e; }
    body.light .focus-delivery { background: #fffbeb; border-color: #fde68a; }
    body.light .focus-delivery-title { color: #92400e; }
    body.light .focus-delivery-row { color: #78350f; }
    .done-time {
      font-size: 0.75rem;
      font-weight: 600;
      color: #4ade80;
      text-align: right;
    }
    /* ── Historique compact ────────────────────────────────────────────────── */
    .hcard {
      background: #1e293b;
      border-radius: 10px;
      border-left: 5px solid #22c55e;
      padding: 10px 14px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.15s;
      user-select: none;
    }
    .hcard:hover { background: #263348; }
    .hcard-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .hcard-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .hcard-num {
      font-size: 1.2rem;
      font-weight: 900;
      color: #f1f5f9;
      white-space: nowrap;
    }
    .hcard-items-count {
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      white-space: nowrap;
    }
    .hcard-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .hcard-times {
      font-size: 0.75rem;
      color: #94a3b8;
      text-align: right;
      white-space: nowrap;
    }
    .hcard-duration {
      font-size: 0.7rem;
      font-weight: 700;
      color: #4ade80;
      background: #14532d;
      padding: 2px 7px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .hcard-total {
      font-size: 0.85rem;
      font-weight: 700;
      color: #94a3b8;
      white-space: nowrap;
    }
    .hcard-details {
      display: none;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #ffffff10;
    }
    .hcard.open .hcard-details { display: block; }
    .hcard-chevron {
      font-size: 0.7rem;
      color: #475569;
      transition: transform 0.2s;
    }
    .hcard.open .hcard-chevron { transform: rotate(180deg); }
    .btn-reannounce {
      background: #1e3a5f;
      border: none;
      color: #93c5fd;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      white-space: nowrap;
    }
    .btn-reannounce:hover { background: #1d4ed8; color: #fff; }
    .btn-reannounce:active { transform: scale(0.95); }
    .btn-reannounce:disabled { opacity: 0.5; cursor: not-allowed; }
    body.light .btn-reannounce { background: #dbeafe; color: #1d4ed8; }
    body.light .btn-reannounce:hover { background: #3b82f6; color: #fff; }
    /* thème clair historique */
    body.light .hcard { background: #ffffff; }
    body.light .hcard:hover { background: #f8fafc; }
    body.light .hcard-num { color: #0f172a; }
    body.light .hcard-items-count { color: #64748b; }
    body.light .hcard-times { color: #64748b; }
    body.light .hcard-total { color: #475569; }
    body.light .hcard-duration { color: #16a34a; background: #dcfce7; }
    body.light .hcard-details { border-top-color: #e2e8f0; }
    /* ── Thème clair ─────────────────────────────────────────────────────────── */
    body.light { background: #f1f5f9; color: #0f172a; }
    body.light header { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
    body.light h1 { color: #0f172a; }
    body.light #count { color: #64748b; }
    body.light .card { background: #ffffff; border-color: #e2e8f0; }
    body.light .card .order-num { color: #0f172a; }
    body.light .card .item-name { color: #0f172a; }
    body.light .card .item-variant,
    body.light .card .modifiers { color: #64748b; }
    body.light .card .composition { color: #c2410c; }
    body.light .card .item-note { color: #92400e; }
    body.light .card .timer { color: #64748b; }
    body.light .card .item { border-bottom-color: #e2e8f020; }
    body.light .card-total { color: #475569; border-top-color: #e2e8f0; }
    body.light .done-time { color: #16a34a; }
    body.light .tab { background: #e2e8f0; color: #475569; }
    body.light .tab.active { background: #3b82f6; color: #fff; }
    body.light .empty { color: #94a3b8; }
    #theme-btn {
      background: none; border: none; font-size: 1.3rem;
      cursor: pointer; padding: 6px; line-height: 1;
      color: #94a3b8; transition: color 0.2s;
    }
    #theme-btn:hover { color: #e2e8f0; }
    body.light #theme-btn { color: #475569; }
    body.light #theme-btn:hover { color: #0f172a; }
    #clock {
      font-size: 0.85rem; font-weight: 600; color: #94a3b8;
      white-space: nowrap;
    }
    body.light #clock { color: #475569; }
    /* ── Responsive ───────────────────────────────────────────────────────── */
    @media (max-width: 600px) {
      body { padding: 6px; }
      header { padding: 6px 2px 10px; }
      h1 { font-size: 1.2rem; }
      .order-num { font-size: 1.5rem; }
      .card { padding: 12px; border-radius: 10px; }
      .btn-ready { padding: 12px; font-size: 0.95rem; }
      .hcard-row { flex-wrap: wrap; }
      .hcard-right { flex-wrap: wrap; justify-content: flex-end; }
    }
    /* ── Toolbar flottante bas-droite ─────────────────────────────────────── */
    .floating-toolbar {
      position: fixed;
      bottom: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 999;
      opacity: 0.4;
      transition: opacity 0.2s;
    }
    .floating-toolbar:hover { opacity: 1; }
    .ftb {
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 10px;
      background: #1e293b;
      color: #e2e8f0;
      font-size: 1.1rem;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
      box-shadow: 0 2px 8px #0004;
    }
    .ftb:hover { background: #334155; }
    .ftb:active { transform: scale(0.93); }
    body.light .ftb { background: #ffffff; color: #0f172a; box-shadow: 0 2px 8px #0002; }
    body.light .ftb:hover { background: #e2e8f0; }
    .ftb-sep { height: 1px; background: #ffffff15; margin: 2px 4px; }
    body.light .ftb-sep { background: #e2e8f015; }
    /* ── Pagination historique ───────────────────────────────────────────── */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 0 8px;
    }
    .pagination button {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      background: #334155;
      color: #e2e8f0;
      transition: background 0.15s;
    }
    .pagination button:hover { background: #475569; }
    .pagination button:disabled { opacity: 0.3; cursor: not-allowed; }
    .pagination .page-info {
      font-size: 0.85rem;
      font-weight: 600;
      color: #94a3b8;
    }
    body.light .pagination button { background: #e2e8f0; color: #0f172a; }
    body.light .pagination button:hover { background: #cbd5e1; }
    body.light .pagination .page-info { color: #64748b; }
  </style>
</head>
<body>
  <header>
    <div style="display:flex;align-items:center;gap:12px;">
      <img id="header-logo" alt="" style="height:48px;width:auto;object-fit:contain;display:none;border-radius:6px;" />
      <div>
        <div style="display:flex;align-items:baseline;gap:8px;">
          <h1><svg class="ico ico-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4"/></svg> Cuisine</h1>
          <span id="restaurant-name" style="font-size:0.85rem;font-weight:600;color:#64748b;"></span>
        </div>
        <div id="count">Chargement…</div>
      </div>
    </div>
    <div class="tabs">
      <button class="tab" id="tab-web" onclick="showTab('web')"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Web <span id="web-count-badge" class="web-count-badge" style="display:none">0</span></button>
      <button class="tab active" id="tab-active" onclick="showTab('active')"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> En cours</button>
      <button class="tab" id="tab-history" onclick="showTab('history')"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg> Historique</button>
    </div>
    <div style="display:flex;align-items:center;gap:12px;">
      <span id="clock"></span>
      <button id="theme-btn" onclick="toggleTheme()" title="Changer le thème"><svg class="ico" id="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg></button>
      <span id="ws-status" class="disconnected"><svg class="ico ico-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg> Déconnecté</span>
    </div>
  </header>
  <div id="web-grid" style="display:none;"></div>
  <div id="grid"></div>
  <div id="history-grid" style="display:none;padding:12px;"></div>

  <div class="floating-toolbar">
    <button class="ftb" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Haut de page">\u25B2</button>
    <button class="ftb" onclick="zoomPage(1)" title="Zoom +">+</button>
    <button class="ftb" onclick="zoomPage(-1)" title="Zoom -">\u2212</button>
    <div class="ftb-sep"></div>
    <button class="ftb" onclick="loadOrders()" title="Rafra\xEEchir">\u21BB</button>
    <button class="ftb" onclick="window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'})" title="Bas de page">\u25BC</button>
  </div>

  <script>
    let orders        = {};
    let historyOrders = {};
    let webOrders     = {};
    let currentTab    = 'active';
    let appCurrency   = 'EUR';
    let ws = null;
    let resizeTimer;
    let historyPage   = 1;
    const HISTORY_PAGE_SIZE = 20;

    // SVG icons (inline, no emoji)
    var ICO = {
      note: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
      globe: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      user: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      truck: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 13.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
      phone: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
      pin: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
      money: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      clock: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      timer: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>',
      check: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
      speaker: '<svg class="ico ico-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
      checkCircle: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>',
    };

    // ── Zoom ─────────────────────────────────────────────────────────────────
    (function initZoom() {
      const z = parseFloat(localStorage.getItem('cuisine-zoom') || '100');
      document.body.style.zoom = z + '%';
    })();

    function zoomPage(dir) {
      let z = parseFloat(localStorage.getItem('cuisine-zoom') || '100');
      z = Math.min(200, Math.max(50, z + dir * 10));
      document.body.style.zoom = z + '%';
      localStorage.setItem('cuisine-zoom', String(z));
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (currentTab === 'active') renderOrders();
      }, 150);
    }

    // ── Thème ─────────────────────────────────────────────────────────────────
    var SVG_MOON = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>';
    var SVG_SUN = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';

    (function initTheme() {
      const saved = localStorage.getItem('cuisine-theme');
      if (saved === 'light') {
        document.body.classList.add('light');
        document.getElementById('theme-btn').innerHTML = SVG_SUN;
      }
    })();

    function toggleTheme() {
      const isLight = document.body.classList.toggle('light');
      localStorage.setItem('cuisine-theme', isLight ? 'light' : 'dark');
      document.getElementById('theme-btn').innerHTML = isLight ? SVG_SUN : SVG_MOON;
    }

    // ── Horloge synchro serveur ─────────────────────────────────────────────
    let serverOffset = 0; // diff entre heure serveur et heure locale

    function syncedNow() { return new Date(Date.now() + serverOffset); }

    (async function syncClock() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const serverTime = new Date(res.headers.get('Date')).getTime();
          if (!isNaN(serverTime)) serverOffset = serverTime - Date.now();
        }
      } catch {}
    })();

    function updateClock() {
      const now = syncedNow();
      const date = now.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      document.getElementById('clock').textContent = date + '  ' + time;
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ── Date du jour (pour filtre et reset minuit) ────────────────────────────
    function todayStart() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }

    // Reset automatique à minuit : vider l'affichage et recharger
    let currentDay = new Date().toDateString();
    setInterval(() => {
      const today = new Date().toDateString();
      if (today !== currentDay) {
        currentDay = today;
        orders = {};
        historyOrders = {};
        webOrders = {};
        historyPage = 1;
        loadOrders();
      }
    }, 60000);

    // ── Onglets ───────────────────────────────────────────────────────────────
    function showTab(tab) {
      currentTab = tab;
      document.getElementById('tab-web').className     = 'tab' + (tab === 'web'     ? ' active' : '');
      document.getElementById('tab-active').className  = 'tab' + (tab === 'active'  ? ' active' : '');
      document.getElementById('tab-history').className = 'tab' + (tab === 'history' ? ' active' : '');
      document.getElementById('web-grid').style.display     = tab === 'web'     ? '' : 'none';
      document.getElementById('grid').style.display         = tab === 'active'  ? '' : 'none';
      document.getElementById('history-grid').style.display = tab === 'history' ? 'flex' : 'none';
      if (tab === 'web')     renderWebOrders();
      if (tab === 'active')  renderOrders();
      if (tab === 'history') { historyPage = 1; renderHistory(); }
    }

    // ── Utils ─────────────────────────────────────────────────────────────────
    function formatPrice(total) {
      return (total || 0).toLocaleString('fr-FR', { style: 'currency', currency: appCurrency });
    }

    const TYPE_LABEL  = { 'dine-in': 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' };
    const TYPE_BADGE  = { 'dine-in': 'badge-dine-in', takeaway: 'badge-takeaway', delivery: 'badge-delivery' };

    function elapsed(createdAt) {
      const ms = Math.max(0, (Date.now() + serverOffset) - new Date(createdAt).getTime());
      const m  = Math.floor(ms / 60000);
      const s  = Math.floor((ms % 60000) / 1000);
      return m > 0 ? m + 'min ' + s + 's' : s + 's';
    }

    function urgencyClass(createdAt) {
      const m = Math.max(0, (Date.now() + serverOffset) - new Date(createdAt).getTime()) / 60000;
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

      const cardsHtml = list.map(o => {
        const urgency = urgencyClass(o.createdAt);
        const timerClass = urgency === 'urgent' ? 'urgent' : urgency === 'warning' ? 'warning' : '';
        const nbItems = (o.lines || []).reduce((s, l) => s + l.quantity, 0);

        const itemsHtml = (o.lines || []).map(l => {
          var compositions = (l.modifiers || []).filter(m => m.isComposition);
          var supplements = (l.modifiers || []).filter(m => !m.isComposition);
          var fraction = compositions.length === 2 ? '\u00BD' : compositions.length === 3 ? '\u2153' : compositions.length === 4 ? '\u00BC' : compositions.length > 0 ? '1/' + compositions.length : '';
          var compsHtml = compositions.map(m => '<div class="composition">' + fraction + ' ' + esc(m.optionName) + '</div>').join('');
          var modsHtml = supplements.length > 0 ? '<div class="modifiers">+ ' + supplements.map(m => esc(m.optionName)).join(', ') + '</div>' : '';
          return '<li class="item">'
            + '<span class="qty">\xD7' + l.quantity + '</span>'
            + '<div class="item-body">'
            + '<div class="item-name">' + esc(l.productName) + '</div>'
            + (l.variantSize ? '<div class="item-variant">' + esc(l.variantSize) + '</div>' : '')
            + compsHtml
            + modsHtml
            + (l.note ? '<div class="item-note">' + ICO.note + ' ' + esc(l.note) + '</div>' : '')
            + '</div></li>';
        }).join('');

        const deliveryNote = o.type === 'delivery' && (o.deliveryCustomerName || o.deliveryAddress)
          ? '<div class="delivery-note">' + ICO.truck + ' '
            + [o.deliveryCustomerName, o.deliveryPhone, o.deliveryAddress]
              .filter(Boolean).map(esc).join(' — ')
            + '</div>'
          : '';

        return '<div class="card ' + urgency + '" id="card-' + o.id + '">'
          + '<div class="card-header">'
          + '<div class="order-num">N\xB0' + esc(o.orderNumber || '\u2014') + '</div>'
          + '<div class="badges">'
          + (o.source === 'web' ? '<span class="badge badge-web">' + ICO.globe + ' WEB</span>' : '')
          + '<span class="badge ' + (TYPE_BADGE[o.type] || '') + '">' + esc(TYPE_LABEL[o.type] || o.type) + '</span>'
          + '<span class="hcard-items-count">' + nbItems + ' article' + (nbItems > 1 ? 's' : '') + '</span>'
          + '<span class="timer ' + timerClass + '" id="timer-' + o.id + '">' + elapsed(o.createdAt) + '</span>'
          + '</div></div>'
          + (o.source === 'web' && (o.deliveryCustomerName || o.web_customer_phone)
            ? '<div class="web-customer">' + ICO.user + ' ' + [o.deliveryCustomerName, o.web_customer_phone].filter(Boolean).map(esc).join(' — ') + '</div>'
            : '')
          + '<ul class="items">' + itemsHtml + '</ul>'
          + (o.notes ? '<div class="delivery-note" style="background:#78350f;border-color:#92400e">' + ICO.note + ' ' + esc(o.notes) + '</div>' : '')
          + deliveryNote
          + '<div class="card-total">Total : ' + formatPrice(o.total) + '</div>'
          + '<button class="btn-ready" data-id="' + o.id + '">' + ICO.check + ' Pr\xEAt</button>'
          + '</div>';
      });

      masonryRender(grid, cardsHtml);
    }

    // ── Rendu Web Orders (en attente de validation) ────────────────────────────
    function updateWebBadge() {
      var n = Object.keys(webOrders).length;
      var badge = document.getElementById('web-count-badge');
      if (badge) {
        badge.textContent = String(n);
        badge.style.display = n > 0 ? 'inline' : 'none';
      }
    }

    function renderWebOrders() {
      var grid = document.getElementById('web-grid');
      var list = Object.values(webOrders).sort(function(a, b) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

      updateWebBadge();

      var cardsHtml = list.map(function(o) {
        var nbItems = (o.lines || []).reduce(function(s, l) { return s + l.quantity; }, 0);

        var itemsHtml = (o.lines || []).map(function(l) {
          var mods = (l.modifiers || []).filter(function(m) { return !m.isComposition; });
          var modsHtml = mods.length > 0 ? '<div class="modifiers">+ ' + mods.map(function(m) { return esc(m.optionName); }).join(', ') + '</div>' : '';
          return '<li class="item">'
            + '<span class="qty">\xD7' + l.quantity + '</span>'
            + '<div class="item-body">'
            + '<div class="item-name">' + esc(l.productName) + '</div>'
            + (l.variantSize ? '<div class="item-variant">' + esc(l.variantSize) + '</div>' : '')
            + modsHtml
            + (l.note ? '<div class="item-note">' + ICO.note + ' ' + esc(l.note) + '</div>' : '')
            + '</div></li>';
        }).join('');

        var customerInfo = '';
        if (o.deliveryCustomerName || o.web_customer_phone) {
          customerInfo = '<div class="web-customer">' + ICO.user + ' ' + [o.deliveryCustomerName, o.web_customer_phone].filter(Boolean).map(esc).join(' \u2014 ') + '</div>';
        }

        var deliveryNote = o.type === 'delivery' && (o.deliveryAddress)
          ? '<div class="delivery-note">' + ICO.truck + ' ' + [o.deliveryCustomerName, o.deliveryPhone, o.deliveryAddress].filter(Boolean).map(esc).join(' \u2014 ') + '</div>'
          : '';

        var orderNote = o.notes ? '<div class="delivery-note" style="background:#78350f;border-color:#92400e">' + ICO.note + ' ' + esc(o.notes) + '</div>' : '';

        return '<div class="card web-pending" id="wcard-' + o.id + '">'
          + '<div class="card-header">'
          + '<div class="order-num">N\xB0' + esc(o.orderNumber || '\u2014') + '</div>'
          + '<div class="badges">'
          + '<span class="badge badge-web">' + ICO.globe + ' WEB</span>'
          + '<span class="badge ' + (TYPE_BADGE[o.type] || '') + '">' + esc(TYPE_LABEL[o.type] || o.type) + '</span>'
          + '<span class="hcard-items-count">' + nbItems + ' article' + (nbItems > 1 ? 's' : '') + '</span>'
          + '<span class="timer" id="wtimer-' + o.id + '">' + elapsed(o.createdAt) + '</span>'
          + '</div></div>'
          + customerInfo
          + '<ul class="items">' + itemsHtml + '</ul>'
          + orderNote
          + deliveryNote
          + '<div class="card-total">Total : ' + formatPrice(o.total) + '</div>'
          + '<div class="web-actions">'
          + '<button class="btn-accept" data-accept-id="' + o.id + '">' + ICO.check + ' Accepter</button>'
          + '<button class="btn-reject" data-reject-id="' + o.id + '">\u2717 Refuser</button>'
          + '</div>'
          + '</div>';
      });

      masonryRender(grid, cardsHtml, ICO.checkCircle + ' Aucune commande web en attente');
    }

    // Web order timers
    setInterval(function() {
      for (var id in webOrders) {
        var o = webOrders[id];
        var el = document.getElementById('wtimer-' + id);
        if (el) el.textContent = elapsed(o.createdAt);
      }
    }, 1000);

    // Accept web order
    async function acceptWebOrder(id, btn) {
      if (btn) { btn.disabled = true; btn.innerHTML = ICO.timer + ' ...'; }
      try {
        var res = await fetch('/api/web-orders/' + id + '/accept', { method: 'PATCH' });
        if (res.ok) {
          delete webOrders[id];
          renderWebOrders();
          updateWebBadge();
          // Reload active orders to show the accepted one
          loadOrders();
          playBeep();
        } else {
          throw new Error('Erreur ' + res.status);
        }
      } catch(e) {
        console.error(e);
        if (btn) { btn.disabled = false; btn.innerHTML = ICO.check + ' Accepter'; }
      }
    }

    // Reject web order — show predefined reasons panel
    var REJECT_REASONS = [
      'Rupture de stock',
      'Restaurant fermé',
      'Coup de feu (cuisine surchargée)',
      'Adresse hors zone de livraison',
      'Commande incorrecte',
    ];

    function rejectWebOrder(id, btn) {
      // Build overlay with predefined reasons
      var overlay = document.createElement('div');
      overlay.className = 'reject-overlay';
      var panel = document.createElement('div');
      panel.className = 'reject-panel';
      panel.innerHTML = '<h3>Raison du refus</h3>';
      var list = document.createElement('div');
      list.className = 'reject-reasons';

      REJECT_REASONS.forEach(function(reason) {
        var b = document.createElement('button');
        b.className = 'reject-reason-btn';
        b.textContent = reason;
        b.onclick = function() { doReject(id, reason, overlay, btn); };
        list.appendChild(b);
      });
      panel.appendChild(list);

      // "Refuser sans raison" button
      var noReason = document.createElement('button');
      noReason.className = 'reject-reason-btn';
      noReason.style.background = '#6b2121';
      noReason.style.opacity = '0.7';
      noReason.textContent = 'Refuser sans raison';
      noReason.onclick = function() { doReject(id, '', overlay, btn); };
      list.appendChild(noReason);

      var cancel = document.createElement('button');
      cancel.className = 'reject-cancel-btn';
      cancel.textContent = 'Annuler';
      cancel.onclick = function() { document.body.removeChild(overlay); };
      panel.appendChild(cancel);

      overlay.appendChild(panel);
      overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
      document.body.appendChild(overlay);
    }

    async function doReject(id, reason, overlay, originalBtn) {
      // Disable all buttons in the panel
      var btns = overlay.querySelectorAll('.reject-reason-btn');
      btns.forEach(function(b) { b.disabled = true; });

      try {
        var res = await fetch('/api/web-orders/' + id + '/reject', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason }),
        });
        if (res.ok) {
          delete webOrders[id];
          document.body.removeChild(overlay);
          renderWebOrders();
          updateWebBadge();
        } else {
          throw new Error('Erreur ' + res.status);
        }
      } catch(e) {
        console.error(e);
        document.body.removeChild(overlay);
        if (originalBtn) { originalBtn.disabled = false; originalBtn.textContent = '\u2717 Refuser'; }
      }
    }

    // Event delegation for web-grid
    document.getElementById('web-grid').addEventListener('click', function(e) {
      var acceptBtn = e.target.closest('.btn-accept');
      if (acceptBtn && !acceptBtn.disabled) {
        acceptWebOrder(acceptBtn.getAttribute('data-accept-id'), acceptBtn);
        return;
      }
      var rejectBtn = e.target.closest('.btn-reject');
      if (rejectBtn && !rejectBtn.disabled) {
        rejectWebOrder(rejectBtn.getAttribute('data-reject-id'), rejectBtn);
        return;
      }
    });

    // ── Rendu historique (compact + dépliable) ─────────────────────────────────
    function fmtTime(d) { return new Date(d).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }); }

    function fmtDuration(startISO, endISO) {
      const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      return m > 0 ? m + 'min ' + s + 's' : s + 's';
    }

    function renderHistory() {
      const grid = document.getElementById('history-grid');
      const list = Object.values(historyOrders).sort((a, b) =>
        new Date(b.kitchenReadyAt) - new Date(a.kitchenReadyAt)
      );

      if (list.length === 0) {
        grid.innerHTML = '<div class="empty">Aucune commande terminée ce jour</div>';
        return;
      }

      const totalPages = Math.ceil(list.length / HISTORY_PAGE_SIZE);
      if (historyPage > totalPages) historyPage = totalPages;
      const startIdx = (historyPage - 1) * HISTORY_PAGE_SIZE;
      const pageList = list.slice(startIdx, startIdx + HISTORY_PAGE_SIZE);

      const totalItems = (lines) => (lines || []).reduce((s, l) => s + l.quantity, 0);

      const paginationHtml = totalPages > 1
        ? '<div class="pagination">'
          + '<button onclick="historyPrev()" ' + (historyPage <= 1 ? 'disabled' : '') + '>\u25C0 Précédent</button>'
          + '<span class="page-info">' + historyPage + ' / ' + totalPages + ' (' + list.length + ' commandes)</span>'
          + '<button onclick="historyNext()" ' + (historyPage >= totalPages ? 'disabled' : '') + '>Suivant \u25B6</button>'
          + '</div>'
        : '<div class="pagination"><span class="page-info">' + list.length + ' commande' + (list.length > 1 ? 's' : '') + '</span></div>';

      grid.innerHTML = paginationHtml + pageList.map(o => {
        const nbItems = totalItems(o.lines);
        const createdTime = fmtTime(o.createdAt);
        const readyTime = o.kitchenReadyAt ? fmtTime(o.kitchenReadyAt) : '';
        const duration = o.kitchenReadyAt ? fmtDuration(o.sentToKitchenAt || o.createdAt, o.kitchenReadyAt) : '';

        const itemsHtml = (o.lines || []).map(l => {
          var compositions = (l.modifiers || []).filter(m => m.isComposition);
          var supplements = (l.modifiers || []).filter(m => !m.isComposition);
          var fraction = compositions.length === 2 ? '\u00BD' : compositions.length === 3 ? '\u2153' : compositions.length === 4 ? '\u00BC' : compositions.length > 0 ? '1/' + compositions.length : '';
          var compsHtml = compositions.map(m => '<div class="composition">' + fraction + ' ' + esc(m.optionName) + '</div>').join('');
          var modsHtml = supplements.length > 0 ? '<div class="modifiers">+ ' + supplements.map(m => esc(m.optionName)).join(', ') + '</div>' : '';
          return '<li class="item">'
            + '<span class="qty">\xD7' + l.quantity + '</span>'
            + '<div class="item-body">'
            + '<div class="item-name">' + esc(l.productName) + '</div>'
            + (l.variantSize ? '<div class="item-variant">' + esc(l.variantSize) + '</div>' : '')
            + compsHtml
            + modsHtml
            + (l.note ? '<div class="item-note">' + ICO.note + ' ' + esc(l.note) + '</div>' : '')
            + '</div></li>';
        }).join('');

        const deliveryNote = o.type === 'delivery' && (o.deliveryCustomerName || o.deliveryAddress)
          ? '<div class="delivery-note" style="margin-top:8px">' + ICO.truck + ' '
            + [o.deliveryCustomerName, o.deliveryPhone, o.deliveryAddress]
              .filter(Boolean).map(esc).join(' — ')
            + '</div>'
          : '';

        return '<div class="hcard" onclick="this.classList.toggle(&quot;open&quot;)">'
          + '<div class="hcard-row">'
            + '<div class="hcard-left">'
              + '<span class="hcard-num">N\xB0' + esc(o.orderNumber || '\u2014') + '</span>'
              + '<span class="badge ' + (TYPE_BADGE[o.type] || '') + '">' + esc(TYPE_LABEL[o.type] || o.type) + '</span>'
              + '<span class="hcard-items-count">' + nbItems + ' article' + (nbItems > 1 ? 's' : '') + '</span>'
            + '</div>'
            + '<div class="hcard-right">'
              + '<button class="btn-reannounce" data-reannounce-id="' + o.id + '">' + ICO.speaker + ' R\xe9p\xe9ter</button>'
              + '<span class="hcard-times">' + createdTime + ' \u2192 ' + readyTime + '</span>'
              + (duration ? '<span class="hcard-duration">' + duration + '</span>' : '')
              + '<span class="hcard-total">' + formatPrice(o.total) + '</span>'
              + '<span class="hcard-chevron">\u25BC</span>'
            + '</div>'
          + '</div>'
          + '<div class="hcard-details">'
            + '<ul class="items">' + itemsHtml + '</ul>'
            + deliveryNote
          + '</div>'
        + '</div>';
      }).join('') + (totalPages > 1 ? paginationHtml : '');
    }

    function historyPrev() { if (historyPage > 1) { historyPage--; renderHistory(); window.scrollTo({top:0,behavior:'smooth'}); } }
    function historyNext() { var totalPages = Math.ceil(Object.keys(historyOrders).length / HISTORY_PAGE_SIZE); if (historyPage < totalPages) { historyPage++; renderHistory(); window.scrollTo({top:0,behavior:'smooth'}); } }

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
    }, 1000);

    // ── Action "Prêt" ─────────────────────────────────────────────────────────
    async function markReady(id, btn) {
      if (btn) { btn.disabled = true; btn.innerHTML = ICO.timer + ' ...'; }
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
        if (btn) { btn.disabled = false; btn.innerHTML = ICO.check + ' Pr\xEAt'; }
      }
    }

    // Event delegation — un seul listener pour tous les boutons "Prêt" + focus card
    document.getElementById('grid').addEventListener('click', function(e) {
      const btn = e.target.closest('.btn-ready');
      if (btn && !btn.disabled) {
        markReady(btn.getAttribute('data-id'), btn);
        return;
      }
      // Focus sur la card si on clique dessus (pas sur le bouton Prêt)
      const card = e.target.closest('.card');
      if (card) {
        const id = card.id.replace('card-', '');
        if (orders[id]) showFocusOverlay(orders[id]);
      }
    });

    // ── Focus overlay ───────────────────────────────────────────────────────
    function showFocusOverlay(o) {
      closeFocusOverlay(); // fermer si déjà ouvert
      const urgency = urgencyClass(o.createdAt);
      const nbItems = (o.lines || []).reduce((s, l) => s + l.quantity, 0);
      const createdTime = new Date(o.createdAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

      const itemsHtml = (o.lines || []).map(l => {
        var compositions = (l.modifiers || []).filter(m => m.isComposition);
        var supplements = (l.modifiers || []).filter(m => !m.isComposition);
        var fraction = compositions.length === 2 ? '\u00BD' : compositions.length === 3 ? '\u2153' : compositions.length === 4 ? '\u00BC' : compositions.length > 0 ? '1/' + compositions.length : '';
        var compsHtml = compositions.map(m => '<div class="composition">' + fraction + ' ' + esc(m.optionName) + '</div>').join('');
        var modsHtml = supplements.length > 0 ? '<div class="modifiers">+ ' + supplements.map(m => esc(m.optionName)).join(', ') + '</div>' : '';
        return '<li class="item">'
          + '<span class="qty">\xD7' + l.quantity + '</span>'
          + '<div class="item-body">'
          + '<div class="item-name">' + esc(l.productName) + '</div>'
          + (l.variantSize ? '<div class="item-variant">' + esc(l.variantSize) + '</div>' : '')
          + compsHtml
          + modsHtml
          + (l.note ? '<div class="item-note">' + ICO.note + ' ' + esc(l.note) + '</div>' : '')
          + '</div></li>';
      }).join('');

      const deliveryHtml = o.type === 'delivery' && (o.deliveryCustomerName || o.deliveryAddress || o.deliveryPhone)
        ? '<div class="focus-delivery">'
          + '<div class="focus-delivery-title">' + ICO.truck + ' Livraison</div>'
          + (o.deliveryCustomerName ? '<div class="focus-delivery-row">' + ICO.user + ' ' + esc(o.deliveryCustomerName) + '</div>' : '')
          + (o.deliveryPhone ? '<div class="focus-delivery-row">' + ICO.phone + ' ' + esc(o.deliveryPhone) + '</div>' : '')
          + (o.deliveryAddress ? '<div class="focus-delivery-row">' + ICO.pin + ' ' + esc(o.deliveryAddress) + '</div>' : '')
          + (o.deliveryFee ? '<div class="focus-delivery-row">' + ICO.money + ' Frais : ' + formatPrice(o.deliveryFee) + '</div>' : '')
          + '</div>'
        : '';

      const timerUrgency = urgency === 'urgent' ? ' urgent' : urgency === 'warning' ? ' warning' : '';

      const html = '<div class="focus-overlay">'
        + '<div class="focus-card ' + urgency + '">'
        + '<button class="focus-close">\u2715</button>'
        + '<div class="focus-header">'
        + '<div class="focus-num">N\xB0' + esc(o.orderNumber || '\u2014') + '</div>'
        + '<div class="focus-meta">'
        + (o.source === 'web' ? '<span class="focus-meta-item" style="background:#065f46;color:#6ee7b7">' + ICO.globe + ' WEB</span>' : '')
        + '<span class="focus-meta-item">' + esc(TYPE_LABEL[o.type] || o.type) + '</span>'
        + '<span class="focus-meta-item">' + nbItems + ' article' + (nbItems > 1 ? 's' : '') + '</span>'
        + '<span class="focus-meta-item">' + ICO.clock + ' ' + createdTime + '</span>'
        + '<span class="focus-meta-item timer-badge' + timerUrgency + '" id="focus-timer">' + ICO.timer + ' ' + elapsed(o.createdAt) + '</span>'
        + '</div></div>'
        + '<div class="focus-items"><ul class="items">' + itemsHtml + '</ul></div>'
        + deliveryHtml
        + (o.source === 'web' && (o.deliveryCustomerName || o.web_customer_phone)
          ? '<div class="web-customer" style="margin-top:12px">' + ICO.user + ' Client web : ' + [o.deliveryCustomerName, o.web_customer_phone].filter(Boolean).map(esc).join(' — ') + '</div>'
          : '')
        + '<div class="focus-total">Total : ' + formatPrice(o.total) + '</div>'
        + '<button class="focus-btn-ready" data-focus-id="' + o.id + '">' + ICO.check + ' Pr\xEAt</button>'
        + '</div></div>';

      document.body.insertAdjacentHTML('beforeend', html);

      // Mettre à jour le timer dans le focus
      window._focusTimerInterval = setInterval(() => {
        const el = document.getElementById('focus-timer');
        if (el && orders[o.id]) {
          el.innerHTML = ICO.timer + ' ' + elapsed(o.createdAt);
          const urg = urgencyClass(o.createdAt);
          el.className = 'focus-meta-item timer-badge' + (urg === 'urgent' ? ' urgent' : urg === 'warning' ? ' warning' : '');
        }
      }, 1000);
    }

    function closeFocusOverlay() {
      const overlay = document.querySelector('.focus-overlay');
      if (overlay) overlay.remove();
      if (window._focusTimerInterval) {
        clearInterval(window._focusTimerInterval);
        window._focusTimerInterval = null;
      }
    }

    // Event delegation for focus overlay buttons
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('.focus-btn-ready');
      if (btn) {
        const id = btn.getAttribute('data-focus-id');
        closeFocusOverlay();
        const gridBtn = document.querySelector('#card-' + id + ' .btn-ready');
        markReady(id, gridBtn);
      }
      const closeBtn = e.target.closest('.focus-close');
      if (closeBtn) closeFocusOverlay();
      if (e.target.classList && e.target.classList.contains('focus-overlay')) closeFocusOverlay();
    });

    // Fermer avec Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeFocusOverlay();
    });

    // ── Bouton "Répéter l'annonce" dans l'historique ────────────────────────
    document.getElementById('history-grid').addEventListener('click', function(e) {
      const btn = e.target.closest('.btn-reannounce');
      if (btn && !btn.disabled) {
        e.stopPropagation(); // ne pas toggler le hcard open/close
        reAnnounce(btn.getAttribute('data-reannounce-id'), btn);
      }
    });

    async function reAnnounce(id, btn) {
      if (btn) { btn.disabled = true; btn.innerHTML = ICO.timer + ' Envoi...'; }
      try {
        const res = await fetch('/api/orders/' + id + '/re-announce', { method: 'POST' });
        if (res.ok) {
          if (btn) { btn.innerHTML = ICO.check + ' Envoy\xe9'; }
          setTimeout(function() {
            if (btn) { btn.disabled = false; btn.innerHTML = ICO.speaker + ' R\xe9p\xe9ter'; }
          }, 2000);
        } else {
          throw new Error('Erreur ' + res.status);
        }
      } catch (e) {
        console.error(e);
        if (btn) { btn.disabled = false; btn.textContent = 'Erreur \u2014 r\xe9essayer'; }
      }
    }

    // ── Chargement initial ────────────────────────────────────────────────────
    async function loadOrders() {
      try {
        const nocache = '&_t=' + Date.now();
        const [settingsRes, ordersRes] = await Promise.all([
          fetch('/api/settings?_t=' + Date.now(), { cache: 'no-store' }),
          fetch('/api/orders?start=' + encodeURIComponent(todayStart()) + nocache, { cache: 'no-store' }),
        ]);
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          if (s.currency) appCurrency = s.currency;
          if (s.restaurantName) {
            document.getElementById('restaurant-name').textContent = s.restaurantName;
          }
          if (s.logo) {
            const img = document.getElementById('header-logo');
            img.src = s.logo;
            img.style.display = 'block';
          }
        }
        const data = await ordersRes.json();
        const list = data.orders || data;
        orders = {};
        historyOrders = {};
        webOrders = {};
        for (const o of list) {
          if (o.source === 'web' && o.status === 'pending') {
            webOrders[o.id] = o;
          } else if (o.sentToKitchenAt && !o.kitchenReadyAt && o.status !== 'cancelled') {
            orders[o.id] = o;
          } else if (o.kitchenReadyAt && o.status !== 'cancelled') {
            historyOrders[o.id] = o;
          }
        }
        renderOrders();
        renderWebOrders();
        updateWebBadge();
        if (currentTab === 'history') renderHistory();
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
        el.innerHTML = '<svg class="ico ico-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg> Connecté';
        el.className = 'connected';
      };

      ws.onclose = () => {
        const el = document.getElementById('ws-status');
        el.innerHTML = '<svg class="ico ico-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg> Déconnecté';
        el.className = 'disconnected';
        setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);

          if (type === 'web-order:new') {
            // New web order pending validation
            webOrders[payload.id] = payload;
            renderWebOrders();
            updateWebBadge();
            playBeep();
          } else if (type === 'web-order:rejected') {
            delete webOrders[payload.id];
            renderWebOrders();
            updateWebBadge();
          } else if (type === 'order:created') {
            // Accepted web order or new POS order → "En cours"
            if (payload.sentToKitchenAt && !payload.kitchenReadyAt && payload.status !== 'cancelled') {
              delete webOrders[payload.id]; // remove from web tab if was there
              orders[payload.id] = payload;
              renderOrders();
              renderWebOrders();
              updateWebBadge();
              playBeep();
            }
          } else if (type === 'order:status') {
            const o = payload.order;
            if (!o) return;
            if (o.sentToKitchenAt && !o.kitchenReadyAt && o.status !== 'cancelled') {
              const isNew = !orders[o.id];
              delete webOrders[o.id];
              orders[o.id] = o;
              renderOrders();
              renderWebOrders();
              updateWebBadge();
              if (isNew) playBeep();
            } else if (o.kitchenReadyAt && o.status !== 'cancelled') {
              delete orders[o.id];
              historyOrders[o.id] = o;
              renderOrders();
              if (currentTab === 'history') renderHistory();
            } else if (orders[o.id]) {
              delete orders[o.id];
              renderOrders();
            }
          } else if (type === 'order:deleted') {
            delete orders[payload.id];
            delete historyOrders[payload.id];
            delete webOrders[payload.id];
            renderOrders();
            renderWebOrders();
            updateWebBadge();
            if (currentTab === 'history') renderHistory();
          } else if (type === 'kitchen:purged') {
            orders = {};
            historyOrders = {};
            webOrders = {};
            loadOrders();
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

    // ── Masonry — distribue les cartes HTML dans des colonnes ──────────────────
    function masonryRender(gridEl, cardsHtml, emptyMsg) {
      if (!gridEl) return;
      if (!cardsHtml.length) {
        gridEl.innerHTML = '<div class="empty">' + (emptyMsg || ICO.checkCircle + ' Pas de commande en attente') + '</div>';
        return;
      }

      // Calculer le nombre de colonnes selon la largeur dispo
      const w = gridEl.clientWidth || document.body.clientWidth - 24;
      const colCount = Math.max(1, Math.floor((w + 12) / (280 + 12)));

      // Créer les colonnes et distribuer en round-robin (gauche → droite)
      const cols = [];
      for (let i = 0; i < colCount; i++) {
        cols.push('');
      }
      for (let i = 0; i < cardsHtml.length; i++) {
        cols[i % colCount] += cardsHtml[i];
      }

      gridEl.innerHTML = cols.map(c =>
        '<div class="masonry-col">' + c + '</div>'
      ).join('');
    }

    // ── Recalcul masonry au resize / zoom ──────────────────────────────────────
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (currentTab === 'active')  renderOrders();
      }, 150);
    });

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
        '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:4rem;background:#0f172a;color:#94a3b8"><h1>Tablette cuisine désactivée</h1><p>Ce service est désactivé dans les paramètres du POS.</p></body></html>'
      );
    }
    reply
      .header('Cache-Control', 'no-store, no-cache, must-revalidate')
      .header('Pragma', 'no-cache')
      .header('Expires', '0')
      .type('text/html')
      .send(HTML);
  });
}
