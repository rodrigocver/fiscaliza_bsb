// Decide o que fazer com as issues de alerta depois de uma ingestão: abrir quando uma tarefa falha, comentar quando
// continua falhando e fechar quando volta a passar. No máximo uma issue aberta por tarefa. O envio fica em
// scripts/alertar-ingestao.ts; aqui só a decisão, testada em tests/alertas.test.ts.

/** Última execução de cada tarefa nesta rodada, lida de ingestao_log. */
export type ResultadoTarefa = { tarefa: string; status: string; erro: string | null };
export type IssueAberta = { numero: number; titulo: string };
export type Acao =
  | { tipo: "abrir"; titulo: string; corpo: string }
  | { tipo: "comentar"; numero: number; corpo: string }
  | { tipo: "fechar"; numero: number; corpo: string };

const PREFIXO = "Ingestão falhou: ";
/** Usada quando a etapa falha antes de qualquer tarefa registrar resultado (migração, banco fora do ar). */
export const TAREFA_GERAL = "execução";
const LIMITE_ERRO = 1500;

export const tituloAlerta = (tarefa: string) => `${PREFIXO}${tarefa}`;

function resumoErro(erro: string | null): string {
  const texto = (erro ?? "sem mensagem registrada").trim();
  const curto = texto.length > LIMITE_ERRO ? `${texto.slice(0, LIMITE_ERRO)}…` : texto;
  return "```\n" + curto.replaceAll("```", "'''") + "\n```";
}

export function planejarAlertas({
  resultados,
  abertas,
  etapaFalhou,
  execucao,
}: {
  resultados: ResultadoTarefa[];
  abertas: IssueAberta[];
  /** A etapa "Ingerir" terminou com erro (inclui falhas que não chegaram ao ingestao_log). */
  etapaFalhou: boolean;
  /** Link da execução no GitHub Actions. */
  execucao: string;
}): Acao[] {
  const porTitulo = new Map(abertas.filter((i) => i.titulo.startsWith(PREFIXO)).map((i) => [i.titulo, i.numero]));
  // "rodando" sem fim registrado: o processo morreu no meio da tarefa.
  const falhas = resultados
    .filter((r) => r.status !== "ok")
    .map((r) => ({ tarefa: r.tarefa, erro: r.status === "rodando" ? "Interrompida antes de terminar." : r.erro }));
  if (etapaFalhou && falhas.length === 0) {
    falhas.push({ tarefa: TAREFA_GERAL, erro: "A etapa terminou com erro antes de registrar tarefas; ver o log." });
  }

  const acoes: Acao[] = [];
  for (const { tarefa, erro } of falhas) {
    const titulo = tituloAlerta(tarefa);
    const numero = porTitulo.get(titulo);
    if (numero != null) {
      acoes.push({ tipo: "comentar", numero, corpo: `Falhou de novo em ${execucao}:\n\n${resumoErro(erro)}` });
    } else {
      acoes.push({
        tipo: "abrir",
        titulo,
        corpo:
          `A tarefa \`${tarefa}\` da ingestão falhou em ${execucao}.\n\n${resumoErro(erro)}\n\n` +
          "Falhas seguintes viram comentários nesta issue, que fecha sozinha quando a tarefa voltar a passar. " +
          "O histórico de cada tarefa está na página `/status` do site.",
      });
    }
  }

  // Fecha as issues de tarefas que passaram nesta rodada. Uma execução sem falhas também encerra a issue geral.
  const passaram = resultados.filter((r) => r.status === "ok").map((r) => r.tarefa);
  if (!etapaFalhou && resultados.length > 0) passaram.push(TAREFA_GERAL);
  for (const tarefa of passaram) {
    const numero = porTitulo.get(tituloAlerta(tarefa));
    if (numero != null) acoes.push({ tipo: "fechar", numero, corpo: `Voltou a passar em ${execucao}.` });
  }
  return acoes;
}
