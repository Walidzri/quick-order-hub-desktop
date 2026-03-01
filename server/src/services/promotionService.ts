import { randomUUID } from 'crypto';
import type { Promotion, PromoType } from '@shared/types';
import { getDatabase } from '../db/connection';

// ─── helpers ────────────────────────────────────────────────────────────────

function rowToPromotion(row: Record<string, unknown>): Promotion {
  return {
    id:            row['id']    as string,
    code:          row['code']  as string,
    name:          (row['name'] as string | null) ?? '',
    type:          row['type']  as PromoType,
    value:         row['value'] as number,
    active:        row['active'] === 1 || row['active'] === true,
    startDate:     new Date(row['startDate'] as string),
    endDate:       new Date(row['endDate'] as string),
    minOrderTotal: (row['minOrderTotal'] as number | null) ?? undefined,
    freeItemId:    (row['freeItemId']    as string | null) ?? undefined,
  };
}

// ─── service ────────────────────────────────────────────────────────────────

export const promotionService = {

  getAll(): Promotion[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM promotions ORDER BY code').all() as Record<string, unknown>[];
    return rows.map(rowToPromotion);
  },

  getById(id: string): Promotion | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM promotions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToPromotion(row) : null;
  },

  getByCode(code: string): Promotion | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM promotions WHERE UPPER(code) = UPPER(?)').get(code) as Record<string, unknown> | undefined;
    return row ? rowToPromotion(row) : null;
  },

  create(data: Partial<Promotion>): Promotion {
    const db = getDatabase();
    const id = data.id ?? randomUUID();
    db.prepare(`
      INSERT INTO promotions (id, code, name, type, value, active, startDate, endDate, minOrderTotal, freeItemId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.code ?? '',
      data.name ?? null,
      data.type ?? 'percent',
      data.value ?? 0,
      data.active !== false ? 1 : 0,
      data.startDate ? new Date(data.startDate).toISOString() : new Date().toISOString(),
      data.endDate   ? new Date(data.endDate).toISOString()   : new Date().toISOString(),
      data.minOrderTotal ?? null,
      data.freeItemId    ?? null,
    );
    return promotionService.getById(id)!;
  },

  update(id: string, data: Partial<Promotion>): Promotion {
    const db = getDatabase();
    const current = promotionService.getById(id);
    if (!current) throw new Error(`Promotion introuvable : ${id}`);
    const merged = { ...current, ...data, id };
    db.prepare(`
      UPDATE promotions SET
        code=?, name=?, type=?, value=?, active=?,
        startDate=?, endDate=?, minOrderTotal=?, freeItemId=?
      WHERE id=?
    `).run(
      merged.code,
      merged.name ?? null,
      merged.type,
      merged.value,
      merged.active ? 1 : 0,
      new Date(merged.startDate).toISOString(),
      new Date(merged.endDate).toISOString(),
      merged.minOrderTotal ?? null,
      merged.freeItemId    ?? null,
      id,
    );
    return promotionService.getById(id)!;
  },

  delete(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM promotions WHERE id = ?').run(id);
  },
};
