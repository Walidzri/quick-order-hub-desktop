import { randomUUID } from 'crypto';
import type { Order, OrderStatus, OrderLine } from '@shared/types';
import { getDatabase } from '../db/connection';
import { syncService } from './syncService';

// ─── helpers ────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  return new Date(val as string);
}

function toDateOrNull(val: unknown): Date | undefined {
  if (!val) return undefined;
  return new Date(val as string);
}

function rowToOrder(row: Record<string, unknown>): Order {
  return {
    id:                   row['id']          as string,
    orderNumber:          row['orderNumber'] as string,
    status:               row['status']      as OrderStatus,
    type:                 row['type']        as Order['type'],
    lines:                JSON.parse(row['lines'] as string ?? '[]') as OrderLine[],
    subtotal:             row['subtotal']    as number,
    discount:             row['discount']    as number,
    total:                row['total']       as number,
    paymentMethod:        (row['paymentMethod']  as Order['paymentMethod'] | null) ?? undefined,
    promoCode:            (row['promoCode']       as string | null) ?? undefined,
    promoName:            (row['promoName']       as string | null) ?? undefined,
    createdBy:            (row['createdBy']       as string | null) ?? undefined,
    createdAt:            toDate(row['createdAt']),
    updatedAt:            toDate(row['updatedAt']),
    paidAt:               toDateOrNull(row['paidAt']),
    sentToKitchenAt:      toDateOrNull(row['sentToKitchenAt']),
    kitchenReadyAt:       toDateOrNull(row['kitchen_ready_at']),
    deliveryAddress:      (row['deliveryAddress']      as string | null) ?? undefined,
    deliveryPhone:        (row['deliveryPhone']        as string | null) ?? undefined,
    deliveryCustomerName: (row['deliveryCustomerName'] as string | null) ?? undefined,
  };
}

/** Génère le numéro de commande du jour (ex: "0042") via numbering_counters. */
function nextOrderNumber(): string {
  const db = getDatabase();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const row = db.prepare('SELECT counter FROM numbering_counters WHERE id = ?').get(today) as
    { counter: number } | undefined;

  const next = (row?.counter ?? 0) + 1;

  db.prepare(`
    INSERT INTO numbering_counters (id, date, counter) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET counter = excluded.counter
  `).run(today, today, next);

  return String(next).padStart(4, '0');
}

// ─── service ────────────────────────────────────────────────────────────────

export const orderService = {

  getAll(): Order[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all() as Record<string, unknown>[];
    return rows.map(rowToOrder);
  },

  getByStatus(status: OrderStatus): Order[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY createdAt DESC').all(status) as Record<string, unknown>[];
    return rows.map(rowToOrder);
  },

  getById(id: string): Order | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToOrder(row) : null;
  },

  create(data: Partial<Order>): Order {
    const db = getDatabase();
    const id          = data.id ?? randomUUID();
    const now         = new Date().toISOString();
    const orderNumber = data.orderNumber ?? nextOrderNumber();

    db.prepare(`
      INSERT INTO orders
        (id, orderNumber, status, type, lines, subtotal, discount, total, paymentMethod,
         promoCode, promoName, createdBy, createdAt, updatedAt, paidAt, sentToKitchenAt,
         deliveryAddress, deliveryPhone, deliveryCustomerName, kitchen_ready_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      orderNumber,
      data.status        ?? 'draft',
      data.type          ?? 'dine-in',
      JSON.stringify(data.lines ?? []),
      data.subtotal      ?? 0,
      data.discount      ?? 0,
      data.total         ?? 0,
      data.paymentMethod ?? null,
      data.promoCode     ?? null,
      data.promoName     ?? null,
      data.createdBy     ?? null,
      data.createdAt ? new Date(data.createdAt).toISOString() : now,
      now,
      data.paidAt        ? new Date(data.paidAt).toISOString()        : null,
      data.sentToKitchenAt ? new Date(data.sentToKitchenAt).toISOString() : null,
      data.deliveryAddress      ?? null,
      data.deliveryPhone        ?? null,
      data.deliveryCustomerName ?? null,
      null,
    );

    syncService.syncOrders().catch(() => {});
    return orderService.getById(id)!;
  },

  update(id: string, data: Partial<Order>): Order {
    const db = getDatabase();
    const current = orderService.getById(id);
    if (!current) throw new Error(`Commande introuvable : ${id}`);

    const merged = { ...current, ...data, id };
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE orders SET
        orderNumber=?, status=?, type=?, lines=?, subtotal=?, discount=?, total=?,
        paymentMethod=?, promoCode=?, promoName=?, createdBy=?,
        updatedAt=?, paidAt=?, sentToKitchenAt=?, kitchen_ready_at=?,
        deliveryAddress=?, deliveryPhone=?, deliveryCustomerName=?,
        sync_status='pending'
      WHERE id=?
    `).run(
      merged.orderNumber,
      merged.status,
      merged.type,
      JSON.stringify(merged.lines ?? []),
      merged.subtotal,
      merged.discount,
      merged.total,
      merged.paymentMethod        ?? null,
      merged.promoCode            ?? null,
      merged.promoName            ?? null,
      merged.createdBy            ?? null,
      now,
      merged.paidAt           ? new Date(merged.paidAt).toISOString()           : null,
      merged.sentToKitchenAt  ? new Date(merged.sentToKitchenAt).toISOString()  : null,
      merged.kitchenReadyAt   ? new Date(merged.kitchenReadyAt).toISOString()   : null,
      merged.deliveryAddress      ?? null,
      merged.deliveryPhone        ?? null,
      merged.deliveryCustomerName ?? null,
      id,
    );

    syncService.syncOrders().catch(() => {});
    return orderService.getById(id)!;
  },

  updateStatus(id: string, status: OrderStatus): Order {
    const db      = getDatabase();
    const current = orderService.getById(id);
    if (!current) throw new Error(`Commande introuvable : ${id}`);

    const now = new Date().toISOString();

    // "paid" est immuable : si la cuisine marque "ready" sur une commande déjà payée,
    // on pose kitchenReadyAt mais on ne régresse pas le statut de paiement.
    const effectiveStatus = current.status === 'paid' && status === 'ready' ? 'paid' : status;

    const paidAt          = effectiveStatus === 'paid'          ? (current.paidAt          ? new Date(current.paidAt).toISOString()          : now) : null;
    const sentToKitchenAt = effectiveStatus === 'sentToKitchen' ? now                                                                                  : (current.sentToKitchenAt ? new Date(current.sentToKitchenAt).toISOString() : null);
    const kitchenReadyAt  = status === 'ready'                  ? now                                                                                  : (current.kitchenReadyAt  ? new Date(current.kitchenReadyAt).toISOString()  : null);

    db.prepare(`
      UPDATE orders SET status=?, updatedAt=?, paidAt=?, sentToKitchenAt=?, kitchen_ready_at=?,
        sync_status='pending' WHERE id=?
    `).run(effectiveStatus, now, paidAt, sentToKitchenAt, kitchenReadyAt, id);

    syncService.syncOrders().catch(() => {});
    return orderService.getById(id)!;
  },

  delete(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  },

  /**
   * Purge des commandes cuisine bloquées des jours précédents.
   * Pose kitchenReadyAt sur toutes les commandes envoyées en cuisine
   * avant aujourd'hui et jamais marquées "prêtes" par le chef.
   * Ne modifie pas le statut de paiement.
   */
  purgeStaleKitchenOrders(): number {
    const db = getDatabase();
    const now = new Date().toISOString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const result = db.prepare(`
      UPDATE orders
      SET kitchen_ready_at = ?, updatedAt = ?, sync_status = 'pending'
      WHERE sentToKitchenAt IS NOT NULL
        AND kitchen_ready_at IS NULL
        AND createdAt < ?
        AND status NOT IN ('cancelled')
    `).run(now, now, todayISO);

    return result.changes as number;
  },
};
