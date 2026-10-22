import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const urlConfigurada = process.env.DATABASE_URL;
if (!urlConfigurada) throw new Error("DATABASE_URL não definida (veja .env.example)");

/**
 * Na Vercel, o endereço "Session pooler" do Supabase (porta 5432) reserva uma conexão por cliente: com várias
 * instâncias, as vagas do plano gratuito acabam e os pedidos ficam parados na fila. O mesmo servidor atende em modo
 * transação na porta 6543, que é o certo para o site (DEPLOY.md); troca sozinho e avisa no log.
 */
export function enderecoParaServerless(url: string, naVercel: boolean): string {
  if (!naVercel || !/\.pooler\.supabase\.com:5432\//.test(url)) return url;
  console.warn("DATABASE_URL usa o Session pooler (5432); usando o Transaction pooler (6543). Ver DEPLOY.md.");
  return url.replace(/(\.pooler\.supabase\.com):5432\//, "$1:6543/");
}
const url = enderecoParaServerless(urlConfigurada, Boolean(process.env.VERCEL));

// Reaproveita a conexão entre recargas do Next.js em desenvolvimento.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };
// Poolers em modo transação (Supabase porta 6543, PgBouncer) não suportam prepared statements.
const viaPooler = /:6543\b|pgbouncer=true/.test(url);
// Em funções serverless (Vercel), cada instância abre o próprio pool; com centenas de instâncias, poucas conexões
// por instância e o pooler do Supabase seguram a carga (DATABASE_POOL_MAX=3; ver docs/ESCALA.md).
const max = Number(process.env.DATABASE_POOL_MAX) || 10;
// Banco que não responde vira erro em 10 s (em vez de travar a página); conexões paradas há 20 s são devolvidas.
export const sql =
  globalForDb.sql ?? postgres(url, { max, prepare: !viaPooler, connect_timeout: 10, idle_timeout: 20 });
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export { schema };
