import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host:     process.env.PG_HOST     || '172.18.0.3',
      port:     parseInt(process.env.PG_PORT || '5432'),
      database: process.env.PG_DATABASE || 'doudoutacos',
      user:     process.env.PG_USER     || 'admin',
      password: process.env.PG_PASSWORD || 'admin',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[PG] Erreur pool inattendue :', err.message);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[PG] Pool fermé');
  }
}
