import { getDatabase } from '../db/connection';
import { wsService } from './wsService';
import { settingsService } from './settingsService';

export interface WebOrderConfig {
  supabaseUrl: string;
  supabaseAnonKey: string; // service_role key (bypasses RLS)
  pollInterval: number; // ms
}

interface SupabaseOrder {
  id: string;
  order_number: number;
  type: 'pickup' | 'delivery';
  status: string;
  notes: string | null;
  delivery_fee: number;
  subtotal: number;
  total: number;
  created_at: string;
  order_lines: {
    id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    notes: string | null;
    compositions: { product_id: string; product_name: string }[] | null;
    products: { name: string };
    product_variants: { name: string };
    variant_prices: { size_label: string };
    order_line_supplements: { price: number; supplements: { name: string } }[];
  }[];
  addresses: {
    address_line: string;
    city: string;
  } | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
}

class WebOrderService {
  private config: WebOrderConfig | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private lastPollAt: string | null = null;

  start(config: WebOrderConfig): void {
    this.config = config;
    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = setInterval(() => {
      this.pullOrders().catch(err =>
        console.warn('[WebOrders] Erreur poll :', err.message)
      );
      this.syncStatusUpdates().catch(err =>
        console.warn('[WebOrders] Erreur sync statuts :', err.message)
      );
    }, config.pollInterval);

    console.log(`[WebOrders] Démarré — Supabase: ${config.supabaseUrl}, intervalle: ${config.pollInterval / 1000}s`);

    // Immediate first pull + status sync
    this.pullOrders().catch(() => {});
    this.syncStatusUpdates().catch(() => {});
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.config = null;
    console.log('[WebOrders] Arrêté');
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  private get headers(): Record<string, string> {
    return {
      'apikey': this.config!.supabaseAnonKey,
      'Authorization': `Bearer ${this.config!.supabaseAnonKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Pull pending orders from Supabase that haven't been synced to POS yet.
   */
  /**
   * Test the connection to Supabase — returns table count or error.
   */
  async testConnection(supabaseUrl: string, supabaseAnonKey: string): Promise<{
    ok: boolean;
    message: string;
    debug: string[];
    ordersCount?: number;
    totalOrders?: number;
  }> {
    const debug: string[] = [];
    const keyPreview = supabaseAnonKey.slice(0, 20) + '...' + supabaseAnonKey.slice(-10);
    debug.push(`URL: ${supabaseUrl}`);
    debug.push(`Key preview: ${keyPreview}`);

    // Decode JWT to check role
    try {
      const payload = JSON.parse(Buffer.from(supabaseAnonKey.split('.')[1], 'base64').toString());
      debug.push(`JWT role: ${payload.role}`);
      debug.push(`JWT ref: ${payload.ref}`);
      if (payload.role === 'anon') {
        debug.push(`⚠️ ATTENTION: clé "anon" détectée — RLS va bloquer la lecture. Utilisez la clé "service_role" !`);
      }
    } catch {
      debug.push(`⚠️ Impossible de décoder le JWT`);
    }

    const headers = {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    };

    try {
      // Step 1: test basic connection — fetch ALL orders (no filter)
      debug.push(`--- Test 1: GET all orders (no filter) ---`);
      const url1 = `${supabaseUrl}/rest/v1/orders?select=id,pos_synced,status&limit=10`;
      debug.push(`URL: ${url1}`);
      const res1 = await fetch(url1, { headers, signal: AbortSignal.timeout(10_000) });
      debug.push(`HTTP ${res1.status} ${res1.statusText}`);
      const text1 = await res1.text();
      debug.push(`Response body: ${text1.slice(0, 500)}`);

      if (!res1.ok) {
        return { ok: false, message: `HTTP ${res1.status}`, debug };
      }

      let allOrders: unknown[];
      try {
        allOrders = JSON.parse(text1);
      } catch {
        return { ok: false, message: 'Invalid JSON response', debug };
      }
      debug.push(`Total orders returned: ${allOrders.length}`);

      // Step 2: test with pos_synced filter
      debug.push(`--- Test 2: GET orders where pos_synced=false ---`);
      const url2 = `${supabaseUrl}/rest/v1/orders?select=id,pos_synced,status&pos_synced=eq.false&limit=10`;
      debug.push(`URL: ${url2}`);
      const res2 = await fetch(url2, { headers, signal: AbortSignal.timeout(10_000) });
      debug.push(`HTTP ${res2.status} ${res2.statusText}`);
      const text2 = await res2.text();
      debug.push(`Response body: ${text2.slice(0, 500)}`);

      let pendingOrders: unknown[];
      try {
        pendingOrders = JSON.parse(text2);
      } catch {
        return { ok: false, message: 'Invalid JSON for filtered query', debug };
      }
      debug.push(`Pending orders (pos_synced=false): ${pendingOrders.length}`);

      return {
        ok: true,
        message: `Connexion réussie`,
        debug,
        totalOrders: allOrders.length,
        ordersCount: pendingOrders.length,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      debug.push(`❌ Exception: ${msg}`);
      return { ok: false, message: msg, debug };
    }
  }

  async pullOrders(): Promise<{ pulled: number; error?: string }> {
    if (!this.config) return { pulled: 0, error: 'Service non configuré' };

    const db = getDatabase();

    // Get IDs of web orders we already have
    const existingRows = db.prepare(
      `SELECT web_order_id FROM orders WHERE source = 'web' AND web_order_id IS NOT NULL`
    ).all() as { web_order_id: string }[];
    const existingIds = new Set(existingRows.map(r => r.web_order_id));

    // Fetch pending orders from Supabase (not yet synced)
    const query = new URLSearchParams({
      select: `
        id,order_number,type,status,notes,delivery_fee,subtotal,total,created_at,
        order_lines(id,quantity,unit_price,line_total,notes,compositions,
          products(name),
          product_variants(name),
          variant_prices(size_label),
          order_line_supplements(price,supplements(name))
        ),
        addresses(address_line,city),
        profiles!orders_profile_id_fkey(first_name,last_name,phone)
      `.replace(/\s+/g, ''),
      pos_synced: 'eq.false',
      order: 'created_at.asc',
    });

    const url = `${this.config.supabaseUrl}/rest/v1/orders?${query}`;
    console.log(`[WebOrders] Pull URL: ${url}`);

    try {
      const res = await fetch(url, { headers: this.headers, signal: AbortSignal.timeout(15_000) });

      if (!res.ok) {
        const text = await res.text();
        const errMsg = `HTTP ${res.status}: ${text}`;
        console.warn(`[WebOrders] Pull échoué : ${errMsg}`);
        return { pulled: 0, error: errMsg };
      }

      const orders = await res.json() as SupabaseOrder[];
      console.log(`[WebOrders] ${orders.length} commande(s) trouvée(s) sur Supabase (pos_synced=false)`);
      let pulled = 0;

      for (const order of orders) {
        if (existingIds.has(order.id)) {
          // Already imported — just mark as synced on Supabase
          await this.markSyncedOnSupabase(order.id);
          continue;
        }

        // Convert to local order format and insert
        this.insertWebOrder(order);
        pulled++;

        // Mark as synced on Supabase
        await this.markSyncedOnSupabase(order.id);

        // Broadcast to kitchen display (new web order pending validation)
        const localOrder = this.getLocalOrderByWebId(order.id);
        if (localOrder) {
          wsService.broadcast('web-order:new', localOrder);
        }
      }

      this.lastPollAt = new Date().toISOString();
      if (pulled > 0) {
        console.log(`[WebOrders] ${pulled} nouvelle(s) commande(s) importée(s)`);
      }

      return { pulled };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[WebOrders] Pull échoué : ${msg}`);
      return { pulled: 0, error: msg };
    }
  }

  /**
   * Insert a web order into the local SQLite database.
   */
  private insertWebOrder(order: SupabaseOrder): void {
    const db = getDatabase();

    // Build lines in local format
    const lines = order.order_lines.map(line => {
      // Supplements as modifiers
      const supModifiers = line.order_line_supplements.map(s => ({
        optionId: '',
        optionName: s.supplements.name,
        priceAdjustment: s.price,
      }));

      // Compositions as modifiers with isComposition flag
      const compModifiers = (line.compositions || []).map(c => ({
        optionId: c.product_id,
        optionName: c.product_name,
        priceAdjustment: 0,
        isComposition: true,
      }));

      return {
        id: line.id,
        productId: '',
        productName: line.products.name,
        variantId: '',
        variantSize: line.variant_prices.size_label,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        modifiers: [...compModifiers, ...supModifiers],
        note: line.notes || undefined,
        isManual: false,
      };
    });

    const customerName = order.profiles
      ? `${order.profiles.first_name || ''} ${order.profiles.last_name || ''}`.trim()
      : '';
    const customerPhone = order.profiles?.phone || '';

    const now = new Date().toISOString();
    const orderType = order.type === 'delivery' ? 'delivery' : 'takeaway';

    const deliveryAddress = order.addresses
      ? `${order.addresses.address_line}, ${order.addresses.city}`
      : '';

    db.prepare(`
      INSERT INTO orders (
        id, orderNumber, status, type, lines,
        subtotal, discount, total,
        createdAt, updatedAt,
        deliveryAddress, deliveryPhone, deliveryCustomerName, deliveryFee,
        sync_status,
        source, web_order_id, web_status, web_customer_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `web-${order.id.slice(0, 8)}-${Date.now()}`,
      `W${order.order_number}`,
      'pending',  // Pending until accepted by kitchen
      orderType,
      JSON.stringify(lines),
      order.subtotal,
      0,
      order.total,
      order.created_at,
      now,
      deliveryAddress,
      customerPhone,
      customerName,
      order.delivery_fee || 0,
      'synced',
      'web',
      order.id,
      order.status,
      customerPhone,
    );
  }

  /**
   * Mark an order as synced on Supabase.
   */
  private async markSyncedOnSupabase(orderId: string): Promise<void> {
    if (!this.config) return;
    try {
      await fetch(
        `${this.config.supabaseUrl}/rest/v1/orders?id=eq.${orderId}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({
            pos_synced: true,
            pos_synced_at: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10_000),
        }
      );
    } catch {
      // Non-blocking — will be retried next cycle
    }
  }

  /**
   * Update order status on Supabase (called when POS changes status).
   */
  async updateWebOrderStatus(
    webOrderId: string,
    newStatus: string,
    rejectionReason?: string
  ): Promise<boolean> {
    if (!this.config) return false;

    // Map POS status to website status
    const statusMap: Record<string, string> = {
      'sentToKitchen': 'preparing',
      'ready': 'ready',
      'delivering': 'delivering',
      'paid': 'completed',
      'cancelled': 'cancelled',
    };
    const webStatus = statusMap[newStatus] || newStatus;

    const body: Record<string, unknown> = { status: webStatus };
    if (rejectionReason) body.rejection_reason = rejectionReason;

    try {
      const res = await fetch(
        `${this.config.supabaseUrl}/rest/v1/orders?id=eq.${webOrderId}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        }
      );

      if (!res.ok) {
        console.warn(`[WebOrders] Sync status failed: HTTP ${res.status}`);
        return false;
      }

      // Update local web_status
      const db = getDatabase();
      db.prepare(`UPDATE orders SET web_status = ? WHERE web_order_id = ?`)
        .run(webStatus, webOrderId);

      console.log(`[WebOrders] Statut sync: ${webOrderId} → ${webStatus}`);
      return true;
    } catch (err: unknown) {
      console.warn(`[WebOrders] Sync status error:`, err);
      return false;
    }
  }

  /**
   * Sync status updates from Supabase for active web orders.
   * Handles cases where driver/admin changes status on the website.
   */
  async syncStatusUpdates(): Promise<void> {
    if (!this.config) return;

    const db = getDatabase();

    // Get active web orders (not yet paid/cancelled locally)
    const activeOrders = db.prepare(
      `SELECT id, web_order_id, web_status, status FROM orders
       WHERE source = 'web' AND web_order_id IS NOT NULL
       AND status NOT IN ('paid', 'cancelled')`
    ).all() as { id: string; web_order_id: string; web_status: string; status: string }[];

    if (activeOrders.length === 0) return;

    const webIds = activeOrders.map(o => o.web_order_id);

    // Fetch current statuses from Supabase
    const idsFilter = webIds.map(id => `"${id}"`).join(',');
    const url = `${this.config.supabaseUrl}/rest/v1/orders?select=id,status&id=in.(${idsFilter})`;

    try {
      const res = await fetch(url, { headers: this.headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;

      const remoteOrders = await res.json() as { id: string; status: string }[];

      for (const remote of remoteOrders) {
        const local = activeOrders.find(o => o.web_order_id === remote.id);
        if (!local || local.web_status === remote.status) continue;

        // Status changed on Supabase — update locally
        const statusMap: Record<string, string> = {
          'completed': 'paid',
          'cancelled': 'cancelled',
        };
        const newLocalStatus = statusMap[remote.status];

        db.prepare(`UPDATE orders SET web_status = ?, updatedAt = ? WHERE id = ?`)
          .run(remote.status, new Date().toISOString(), local.id);

        // If completed/cancelled on web, also update local order status
        if (newLocalStatus) {
          db.prepare(`UPDATE orders SET status = ?, updatedAt = ? WHERE id = ?`)
            .run(newLocalStatus, new Date().toISOString(), local.id);
        }

        console.log(`[WebOrders] Statut sync retour: ${local.id} → web_status=${remote.status}${newLocalStatus ? `, status=${newLocalStatus}` : ''}`);

        // Broadcast update
        const updated = this.getLocalOrderByWebId(remote.id);
        if (updated) {
          wsService.broadcast('order:updated', updated);
        }
      }
    } catch {
      // Silently ignore — will retry next cycle
    }
  }

  private getLocalOrderByWebId(webOrderId: string): Record<string, unknown> | null {
    const db = getDatabase();
    const row = db.prepare(
      `SELECT * FROM orders WHERE web_order_id = ?`
    ).get(webOrderId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return { ...row, lines: JSON.parse(row['lines'] as string || '[]') };
  }

  getStatus() {
    return {
      running: this.isRunning(),
      lastPollAt: this.lastPollAt,
      config: this.config ? {
        supabaseUrl: this.config.supabaseUrl,
        pollInterval: this.config.pollInterval,
      } : null,
    };
  }
}

export const webOrderService = new WebOrderService();
