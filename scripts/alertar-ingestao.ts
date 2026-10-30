// Abre, comenta ou fecha issues "Ingestão falhou: <tarefa>" conforme o resultado da ingestão (ver src/ingest/alertas.ts).
// Roda no workflow de ingestão, depois da etapa "Ingerir". Variáveis:
//   INICIO              horário (ISO) em que o job começou: só conta o que foi registrado depois dele
//   RESULTADO_INGERIR   success | failure (steps.ingerir.outcome)
//   GITHUB_TOKEN, GITHUB_REPOSITORY, EXECUCAO_URL
import "dotenv/config";
import { planejarAlertas, type IssueAberta, type ResultadoTarefa } from "@/ingest/alertas";

const { INICIO, RESULTADO_INGERIR, GITHUB_TOKEN, GITHUB_REPOSITORY, EXECUCAO_URL } = process.env;
if (!INICIO || !GITHUB_TOKEN || !GITHUB_REPOSITORY || !EXECUCAO_URL) {
  console.error("Faltam INICIO, GITHUB_TOKEN, GITHUB_REPOSITORY ou EXECUCAO_URL.");
  process.exit(1);
}

async function github<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!res.ok) throw new Error(`GitHub ${metodo} ${caminho}: HTTP ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Sem banco (migração ou conexão falharam), devolve vazio: vira a issue geral "execução". */
async function lerResultados(): Promise<ResultadoTarefa[]> {
  try {
    const { ultimasExecucoes } = await import("@/ingest/log");
    const { sql } = await import("@/db/client");
    const resultados = await ultimasExecucoes(new Date(INICIO!));
    await sql.end();
    return resultados;
  } catch (e) {
    console.warn("Não foi possível ler ingestao_log:", e);
    return [];
  }
}

async function main() {
  const resultados = await lerResultados();
  // Issues de pull request também vêm nessa lista; o filtro por título em planejarAlertas as descarta.
  const abertas = (
    await github<{ number: number; title: string }[]>("GET", "/issues?state=open&per_page=100&labels=ingest%C3%A3o")
  ).map((i): IssueAberta => ({ numero: i.number, titulo: i.title }));

  const acoes = planejarAlertas({
    resultados,
    abertas,
    etapaFalhou: RESULTADO_INGERIR !== "success",
    execucao: EXECUCAO_URL!,
  });
  for (const acao of acoes) {
    if (acao.tipo === "abrir") {
      const { number } = await github<{ number: number }>("POST", "/issues", {
        title: acao.titulo,
        body: acao.corpo,
        labels: ["ingestão", "bug"],
      });
      console.log(`aberta #${number}: ${acao.titulo}`);
    } else {
      await github("POST", `/issues/${acao.numero}/comments`, { body: acao.corpo });
      if (acao.tipo === "fechar") await github("PATCH", `/issues/${acao.numero}`, { state: "closed" });
      console.log(`${acao.tipo === "fechar" ? "fechada" : "comentada"} #${acao.numero}`);
    }
  }
  if (acoes.length === 0) console.log("Nada a fazer.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
