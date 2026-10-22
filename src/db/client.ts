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
/**
 * Pooler em modo transação (Supabase porta 6543, Neon "-pooler", PgBouncer; ou DATABASE_POOLER=1): cada consulta pode
 * cair numa conexão diferente do banco. Ali não valem prepared statements nem "pipelining" (o postgres.js manda até
 * 100 consultas seguidas pela mesma conexão sem esperar as respostas): o pooler perde respostas e a consulta fica
 * esperando para sempre (era o que travava o build na Vercel). Uma consulta por vez por conexão.
 */
export const viaPoolerTransacao = (endereco: string, forcar = process.env.DATABASE_POOLER === "1") =>
  forcar || /:6543\/|-pooler\.|pgbouncer=true/.test(endereco);
const viaPooler = viaPoolerTransacao(url);
// Em funções serverless (Vercel), cada instância abre o próprio pool; com centenas de instâncias, poucas conexões
// por instância e o pooler do Supabase seguram a carga (DATABASE_POOL_MAX=3; ver docs/ESCALA.md).
const max = Number(process.env.DATABASE_POOL_MAX) || 10;
// max_pipeline existe no postgres.js (src/index.js), mas falta nos tipos dele; por isso o objeto separado.
const opcoes = {
  max,
  prepare: !viaPooler,
  max_pipeline: viaPooler ? 0 : 100,
  connect_timeout: 10,
  idle_timeout: 20,
};
// Banco que não responde vira erro em 10 s (em vez de travar a página); conexões paradas há 20 s são devolvidas.
export const sql = globalForDb.sql ?? postgres(url, opcoes);
if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export { schema };
