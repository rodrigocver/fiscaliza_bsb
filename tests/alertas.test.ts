import { describe, it, expect } from "vitest";
import { planejarAlertas, tituloAlerta } from "@/ingest/alertas";

const execucao = "https://github.com/rodrigocver/fiscaliza_bsb/actions/runs/1";
// Erro real da execução de 29/10/2026.
const erroCamara =
  "TypeError: fetch failed ← causa: ConnectTimeoutError: Connect Timeout Error [UND_ERR_CONNECT_TIMEOUT]";

describe("planejarAlertas", () => {
  it("abre uma issue por tarefa que falhou, com o erro e o link da execução", () => {
    const acoes = planejarAlertas({
      resultados: [
        { tarefa: "deputados", status: "ok", erro: null },
        { tarefa: "camara:despesas", status: "erro", erro: erroCamara },
      ],
      abertas: [],
      etapaFalhou: true,
      execucao,
    });
    expect(acoes).toHaveLength(1);
    expect(acoes[0]).toMatchObject({ tipo: "abrir", titulo: "Ingestão falhou: camara:despesas" });
    const corpo = (acoes[0] as { corpo: string }).corpo;
    expect(corpo).toContain(execucao);
    expect(corpo).toContain("UND_ERR_CONNECT_TIMEOUT");
  });

  it("comenta em vez de abrir outra quando já há issue aberta para a tarefa", () => {
    const acoes = planejarAlertas({
      resultados: [{ tarefa: "camara:despesas", status: "erro", erro: erroCamara }],
      abertas: [{ numero: 20, titulo: tituloAlerta("camara:despesas") }],
      etapaFalhou: true,
      execucao,
    });
    expect(acoes).toEqual([expect.objectContaining({ tipo: "comentar", numero: 20 })]);
  });

  it("fecha a issue quando a tarefa volta a passar e ignora issues que não são alertas", () => {
    const acoes = planejarAlertas({
      resultados: [
        { tarefa: "camara:despesas", status: "ok", erro: null },
        { tarefa: "senado:comissoes", status: "ok", erro: null },
      ],
      abertas: [
        { numero: 20, titulo: tituloAlerta("camara:despesas") },
        { numero: 9, titulo: "Avisar quando a ingestão diária falhar" },
      ],
      etapaFalhou: false,
      execucao,
    });
    expect(acoes).toEqual([{ tipo: "fechar", numero: 20, corpo: `Voltou a passar em ${execucao}.` }]);
  });

  it("não fecha a issue de uma tarefa que não rodou nesta execução", () => {
    const acoes = planejarAlertas({
      resultados: [{ tarefa: "deputados", status: "ok", erro: null }],
      abertas: [{ numero: 21, titulo: tituloAlerta("tse") }],
      etapaFalhou: false,
      execucao,
    });
    expect(acoes).toEqual([]);
  });

  it("tarefa interrompida conta como falha", () => {
    const acoes = planejarAlertas({
      resultados: [{ tarefa: "estatisticas", status: "rodando", erro: null }],
      abertas: [],
      etapaFalhou: true,
      execucao,
    });
    expect(acoes[0]).toMatchObject({ tipo: "abrir", titulo: "Ingestão falhou: estatisticas" });
    expect((acoes[0] as { corpo: string }).corpo).toContain("Interrompida");
  });

  it("falha antes de qualquer tarefa abre a issue geral, que fecha na próxima execução sem erro", () => {
    const falha = planejarAlertas({ resultados: [], abertas: [], etapaFalhou: true, execucao });
    expect(falha).toEqual([expect.objectContaining({ tipo: "abrir", titulo: "Ingestão falhou: execução" })]);

    const volta = planejarAlertas({
      resultados: [{ tarefa: "deputados", status: "ok", erro: null }],
      abertas: [{ numero: 22, titulo: "Ingestão falhou: execução" }],
      etapaFalhou: false,
      execucao,
    });
    expect(volta).toEqual([expect.objectContaining({ tipo: "fechar", numero: 22 })]);
  });

  it("corta erros longos e neutraliza cercas de código", () => {
    const [acao] = planejarAlertas({
      resultados: [{ tarefa: "tse", status: "erro", erro: "```" + "x".repeat(3000) }],
      abertas: [],
      etapaFalhou: true,
      execucao,
    });
    const corpo = (acao as { corpo: string }).corpo;
    expect(corpo).toContain("…");
    expect(corpo.match(/```/g)).toHaveLength(2);
  });
});
