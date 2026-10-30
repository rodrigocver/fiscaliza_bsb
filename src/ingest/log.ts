import { desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { descreverErro } from "./http";

// Registra cada execução em ingestao_log — é daí que vem o "atualizado em" do site.
export async function comLog(tarefa: string, fn: () => Promise<number>): Promise<number> {
  const [log] = await db.insert(schema.ingestaoLog).values({ tarefa, status: "rodando" }).returning();
  const inicio = Date.now();
  try {
    const registros = await fn();
    await db
      .update(schema.ingestaoLog)
      .set({ status: "ok", registros, finalizadoEm: new Date() })
      .where(eq(schema.ingestaoLog.id, log.id));
    console.log(`✔ ${tarefa}: ${registros} registros em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
    return registros;
  } catch (e) {
    await db
      .update(schema.ingestaoLog)
      .set({ status: "erro", erro: descreverErro(e), finalizadoEm: new Date() })
      .where(eq(schema.ingestaoLog.id, log.id));
    console.error(`✘ ${tarefa}:`, e);
    throw e;
  }
}

/** Última execução de cada tarefa iniciada a partir de `desde` (uma rodada da ingestão), para os alertas. */
export async function ultimasExecucoes(
  desde: Date,
): Promise<{ tarefa: string; status: string; erro: string | null }[]> {
  return db
    .selectDistinctOn([schema.ingestaoLog.tarefa], {
      tarefa: schema.ingestaoLog.tarefa,
      status: schema.ingestaoLog.status,
      erro: schema.ingestaoLog.erro,
    })
    .from(schema.ingestaoLog)
    .where(gte(schema.ingestaoLog.iniciadoEm, desde))
    .orderBy(schema.ingestaoLog.tarefa, desc(schema.ingestaoLog.id));
}
