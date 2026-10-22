// Uso: npm run ingest -- [tarefa...] [--desde ANO]
//   sem tarefas: roda todas; sem --desde: só o ano corrente (atualização diária).
//   carga histórica: npm run ingest -- --desde 2023
import "dotenv/config";
import { sql, viaPoolerTransacao } from "@/db/client";
import { comLog } from "@/ingest/log";
import { buscarDeputados, buscarSenadores, salvarParlamentares } from "@/ingest/parlamentares";
import { ingerirDespesas, ingerirPresencas, ingerirProposicoes, ingerirVotacoes } from "@/ingest/camara";
import { ingerirDespesasSenado, ingerirProposicoesSenado, ingerirVotacoesSenado } from "@/ingest/senado";
import { calcularEstatisticas } from "@/ingest/estatisticas";
import { ingerirExercicioCamara, ingerirExercicioSenado } from "@/ingest/exercicio";
import { ingerirTemas } from "@/ingest/temas";
import { ingerirTse } from "@/ingest/tse";
import {
  ingerirComissoesCamara,
  ingerirComissoesSenado,
  ingerirRelatoriasSenado,
  ingerirReunioesCamara,
} from "@/ingest/comissoes";
import { lerArgumentosIngestao } from "@/ingest/util";

// A ingestão grava em transações, que o pooler em modo transação (porta 6543) não permite: precisa do endereço
// "Session pooler" (5432) ou da conexão direta. Falha logo, com a explicação, em vez de no meio da carga.
if (viaPoolerTransacao(process.env.DATABASE_URL ?? "")) {
  console.error(
    "DATABASE_URL aponta para um pooler em modo transação (ex.: porta 6543). Para a ingestão use o " +
      "Session pooler (porta 5432) ou a conexão direta. Ver DEPLOY.md, passo 2.",
  );
  process.exit(1);
}

const { tarefas: pedidas, anos } = lerArgumentosIngestao(process.argv.slice(2));

const porAno = (fn: (ano: number) => Promise<number>) => async () => {
  let total = 0;
  for (const ano of anos) total += await fn(ano);
  return total;
};

// A ordem importa: parlamentares primeiro, pois as demais tarefas dependem deles.
const tarefas: Record<string, () => Promise<number>> = {
  deputados: async () => salvarParlamentares(await buscarDeputados()),
  senadores: async () => salvarParlamentares(await buscarSenadores()),
  "camara:exercicio": ingerirExercicioCamara, // períodos em exercício (licenças, suplências)
  "senado:exercicio": ingerirExercicioSenado,
  "camara:presencas": porAno(ingerirPresencas),
  "camara:votacoes": porAno(ingerirVotacoes),
  "camara:proposicoes": porAno(ingerirProposicoes),
  "camara:despesas": porAno(ingerirDespesas),
  "senado:votacoes": porAno(ingerirVotacoesSenado), // inclui o comparecimento
  "senado:proposicoes": porAno(ingerirProposicoesSenado),
  "senado:despesas": porAno(ingerirDespesasSenado),
  "camara:comissoes": ingerirComissoesCamara, // órgãos e membros
  "camara:reunioes": porAno(ingerirReunioesCamara), // reuniões deliberativas de comissão e presença
  "senado:comissoes": ingerirComissoesSenado,
  "senado:relatorias": porAno(ingerirRelatoriasSenado),
  temas: ingerirTemas, // temas das matérias votadas (incremental)
  tse: ingerirTse, // candidaturas, bens declarados e receitas de campanha (eleições de 2018 em diante)
  estatisticas: calcularEstatisticas, // por último: depende de todo o resto
};

// Arquivos grandes que mudam pouco (o TSE só atualiza em ano de eleição): na ingestão diária ficam de fora;
// rodam na carga completa semanal (--desde) ou quando pedidas pelo nome.
const SO_CARGA_COMPLETA = new Set(["tse"]);

async function main() {
  const nomes = pedidas.length
    ? pedidas
    : Object.keys(tarefas).filter((n) => anos.length > 1 || !SO_CARGA_COMPLETA.has(n));
  const desconhecidas = nomes.filter((n) => !tarefas[n]);
  if (desconhecidas.length) {
    console.error(
      `Tarefas desconhecidas: ${desconhecidas.join(", ")}. Disponíveis: ${Object.keys(tarefas).join(", ")}`,
    );
    process.exit(1);
  }
  let falhou = false;
  for (const nome of nomes) {
    try {
      await comLog(nome, tarefas[nome]);
    } catch {
      falhou = true; // segue com as demais; o log guarda o erro
    }
  }
  await sql.end();
  process.exit(falhou ? 1 : 0);
}

main();
