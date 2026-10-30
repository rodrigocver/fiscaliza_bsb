import { beforeAll, describe, expect, it } from "vitest";
import { db, schema, sql } from "@/db/client";
import { ultimasExecucoes } from "@/ingest/log";
import { prepararBanco } from "./dados";

beforeAll(async () => {
  await prepararBanco();
  await db.delete(schema.ingestaoLog);
  return () => sql.end();
});

describe("ultimasExecucoes", () => {
  it("devolve a última execução de cada tarefa desde o início da rodada", async () => {
    const inicio = new Date("2026-10-29T16:09:00Z");
    await db.insert(schema.ingestaoLog).values([
      // Rodada anterior: fica de fora.
      { tarefa: "senado:comissoes", status: "erro", erro: "HTTP 503", iniciadoEm: new Date("2026-10-28T16:00:00Z") },
      { tarefa: "deputados", status: "ok", registros: 648, iniciadoEm: new Date("2026-10-29T16:09:40Z") },
      { tarefa: "camara:despesas", status: "erro", erro: "fetch failed", iniciadoEm: new Date("2026-10-29T16:12:00Z") },
      // A mesma tarefa rodada de novo na rodada: vale a última.
      { tarefa: "camara:despesas", status: "ok", registros: 10, iniciadoEm: new Date("2026-10-29T16:20:00Z") },
    ]);
    const r = await ultimasExecucoes(inicio);
    expect(r).toEqual([
      { tarefa: "camara:despesas", status: "ok", erro: null },
      { tarefa: "deputados", status: "ok", erro: null },
    ]);
  });
});
