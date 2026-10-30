# Fontes de dados

Verificado em 19/10/2026. Se algo mudou na fonte, atualize este arquivo no mesmo pull request.

## Câmara dos Deputados — API v2 `https://dadosabertos.camara.leg.br/api/v2`

| Dado | Endpoint / arquivo | Observação |
|---|---|---|
| Deputados | `GET /deputados`, `/deputados/{id}` | OK, rápido |
| Sessões de plenário | `GET /eventos?codTipoEvento=110` (Sessão Deliberativa) | OK |
| **Presença** | `GET /eventos/{id}/deputados` | Lista quem registrou presença no evento. Presença = sessões presentes / sessões deliberativas no período |
| Votações | `GET /votacoes`, `/votacoes/{id}/votos` | Muitas votações (simbólicas) vêm sem votos — só as nominais têm |
| Votações em lote | `https://dadosabertos.camara.leg.br/arquivos/votacoesVotos/json/votacoesVotos-{ano}.json` | **Preferir** para carga histórica |
| Proposições | `GET /proposicoes?idDeputadoAutor={id}` | OK |
| Despesas (CEAP) | `GET /deputados/{id}/despesas` | **Deu timeout no teste.** Usar arquivo em lote `https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip` |

## Senado Federal — `https://legis.senado.leg.br/dadosabertos`

| Dado | Endpoint | Observação |
|---|---|---|
| Senadores em exercício | `GET /senador/lista/atual.json` | OK |
| Votações | `GET /votacao?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD` (JSON) | **Novo serviço.** O antigo `/senador/{cod}/votacoes` foi desativado em 01/02/2026 |
| Proposições | `GET /processo?...` / matérias por autor | Confirmar formato na fase de ingestão do Senado |
| Despesas (CEAPS) | `https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/{ano}` | OK, JSON anual completo |
| **Presença** | A definir | Senado não expõe lista de presença direta e simples. Opções: (a) comparecimento derivado das votações nominais; (b) serviço de plenário/sessões. **Pesquisar na Fase 4** |

## Conclusões para a arquitetura

1. **Ingestão em lote + banco próprio** é obrigatória: APIs lentas, com timeouts e endpoints que mudam.
2. Guardar `fonte`, `url_origem` e `atualizado_em` em cada registro para transparência.
3. Normalizar Câmara e Senado num modelo comum (`parlamentar`, `sessao`, `presenca`, `votacao`, `voto`, `proposicao`, `despesa`) com coluna `casa` (`CD` / `SF`).
4. Métricas precisam de definição explícita e exibida ao usuário (ex.: "presença = sessões deliberativas com registro de presença ÷ sessões deliberativas do período").
5. Atenção a suplentes/licenças: um parlamentar pode ficar fora do exercício parte do período — calcular sobre os dias em exercício.

## Atualização — Fase 4 (Senado)
- **Presença:** não há lista de presença. Cada voto nominal em `/votacao` traz o código de comparecimento
  (`Sim`, `Não`, `Abstenção`, `Votou` (secreto), `P-NRV` presente sem voto, `Presidente (art. 51 RISF)`,
  `AP` atividade parlamentar, `MIS` missão, `LS`/`LP` licenças, `NCom` não compareceu). Presença = sessões com
  votação nominal em que o senador teve código de presente. Cobre ~36 sessões/ano (o Senado vota muito em modo simbólico).
- **Votações:** `/votacao?dataInicio&dataFim` em janelas mensais; respostas grandes às vezes vêm cortadas — retentar.
- **Orientação de bancada:** `/plenario/votacao/orientacaoBancada/{AAAAMMDD}/{AAAAMMDD}.json`, ligada por `sequencialVotacao`. Raramente preenchida.
- **Proposições:** `/processo?codigoParlamentarAutor=X&dataInicioApresentacao&dataFimApresentacao` (máx. 1 ano por consulta).
- **CEAPS:** JSON anual com `id` único por lançamento.

## Armadilhas conhecidas

| Problema | Como o código lida |
|---|---|
| Downloads grandes chegam cortados sem erro | `baixarArquivo` confere o `Content-Length` e tenta de novo |
| Servidores ficam minutos sem responder (`www.camara.leg.br` sem aceitar conexão em 29/10/2026; HTTP 503 do Senado em 27/10/2026) | `baixarArquivo` espera 30 s, 2 min e 5 min entre tentativas (`ESPERAS_DOWNLOAD`); chamadas de API, que são muitas, seguem com 2, 4 e 8 s. Cada nova tentativa sai no log com o motivo |
| A Câmara regenera os arquivos de madrugada (~01h–02h de Brasília); quem baixa nesse horário recebe JSON truncado | `baixarJson` espera e tenta de novo; o agendamento roda às 06h17 |
| CSV de proposições da Câmara tem aspas malformadas | Usamos a versão JSON do mesmo arquivo |
| `votacoesObjetos` (Câmara) lista pareceres e emendas, não a matéria principal | Usamos `votacoesProposicoes` e o prefixo do id da votação |
| Câmara não informa qual suplente ocupou a vaga de qual titular | `casarSuplentesCamara()` casa pelas datas, estado e partido/federação; ambíguos aparecem como "possíveis" |
| Vários titulares do mesmo partido saem juntos: qual suplente ficou com qual vaga? | Sem resposta segura nos dados públicos (ordem do TSE e ordem das datas testadas; ver issue #19) — mostramos os candidatos |
| Coincidência de horários entre titular e suplente de estados diferentes (ministros voltam juntos para votar) | Exigir mesmo estado e partido/federação; nunca casar só pelo horário |
| Voto vazio na Câmara | É votação secreta (escolha de autoridades): rótulo "Votou (secreto)" |
| Senado devolve objeto quando há um item e lista quando há vários | `comoLista()` |
| Nomes de bancada inconsistentes ("Republica", "Republican", "Progressistas" = PP) | `prioridadeOrientacao()` em `src/ingest/alinhamento.ts`, com testes |
| Nomes de blocos abreviados e cortados ("Bl UniPpPsd...") | `partidosDoBloco()` lê as siglas do nome; partidos escondidos pelo corte não recebem a orientação |

## Outras fontes úteis (ainda não usadas)

| Fonte | Para quê |
|---|---|
| Câmara `GET /blocos`, `/blocos/{id}/partidos` | Composição completa de blocos (resolveria os nomes cortados) |
| Câmara `GET /deputados/{id}/historico` | Entradas e saídas de exercício (suplentes, licenças) |
| Câmara `arquivos/proposicoesTemas/json/proposicoesTemas-{ano}.json` | Temas das proposições — filtro por tema |
| Senado `GET /senador/{codigo}/licencas.json` | Licenças — janela de exercício |

## Comissões (v2)
| Dado | Fonte | Observação |
|---|---|---|
| Órgãos da Câmara | `arquivos/orgaos/json/orgaos.json` | Tipo do órgão em `tipoOrgao` |
| Membros (Câmara) | `arquivos/orgaosDeputados/json/orgaosDeputados-L{n}.json` | Cargo e período; `dataFim` vazio = ainda membro |
| Reuniões e presença (Câmara) | `eventos-{ano}`, `eventosOrgaos-{ano}`, `eventosPresencaDeputados-{ano}` | Presença registrada em ~99% das reuniões deliberativas |
| Relatorias (Câmara) | — | `/proposicoes/{id}/relatores` responde 405; não há arquivo em lote |
| Membros (Senado) | `/senador/{codigo}/comissoes.json` | Sem tipo de colegiado; grupos parlamentares identificados pelo nome |
| Relatorias (Senado) | `/processo/relatoria?codigoParlamentar&dataInicio&dataFim` | Máximo 1 ano por consulta; consulta sem parlamentar dá 503; a resposta pode repetir itens |
| Presença em comissões (Senado) | — | `/comissao/reuniao/{codigo}` não traz lista de presença |

## TSE (v2)
Base: `https://cdn.tse.jus.br/estatistica/sead/odsele`. Arquivos zip com CSV em latin1, separador `;`.

| Dado | Arquivo | Observação |
|---|---|---|
| Candidaturas | `consulta_cand/consulta_cand_{ano}.zip` | Um registro por candidatura; pode haver registro anulado (`#NULO#`) e refeito da mesma pessoa |
| Bens declarados | `bem_candidato/bem_candidato_{ano}.zip` | `DS_BEM_CANDIDATO` pode trazer endereço; não é guardado |
| Receitas (2018+) | `prestacao_contas/prestacao_de_contas_eleitorais_candidatos_{ano}.zip` | ~1 GB; lemos só `receitas_candidatos_{ano}_{UF}.csv` por requisições de intervalo (`src/ingest/zipRemoto.ts`) |
| Receitas (2014) | `prestacao_contas/prestacao_final_2014.zip` | `receitas_candidatos_2014_{UF}.txt`; cabeçalho por extenso ("Sequencial Candidato", "Valor receita", "Tipo receita") |
| Receitas (2010) | `prestacao_contas/prestacao_contas_2010.zip` | `candidato/{UF}/ReceitasCandidatos.txt`; mesmo cabeçalho por extenso, com espaços sobrando no fim |

Armadilhas:
- O CPF aparece mascarado ("-4") em registros anulados; ignorado na verificação de homônimos.
- O arquivo de 2018 traz a **eleição suplementar de senador de MT em 2020** (`DS_ELEICAO`, `DT_ELEICAO`).
- O mesmo político pode ter registro anulado como 1º suplente e válido como senador no mesmo ano.
- Tipos de bem às vezes em maiúsculas ("OUTROS BENS E DIREITOS"), às vezes não.
- Até 2010: cargos "1º SUPLENTE SENADOR"/"2º SUPLENTE SENADOR", situação "MÉDIA" (eleito por média) e "#NULO" (sem
  o # final); nos bens, `NR_ORDEM_CANDIDATO` em vez de `NR_ORDEM_BEM_CANDIDATO`. Tipos de receita em maiúsculas.
- Até 2014 havia doação de empresas ("Recursos de pessoas jurídicas") e comitês financeiros ("Recursos de outros
  candidatos/comitês").
- Os arquivos de 2010 e 2014 repetem cada candidato em mais de uma linha; a escolha do registro preferido resolve.
- Valores de receita sem centavos aparecem como inteiro ("30000"); com centavos, com vírgula ("657,72").
- Cobertura em 19/10/2026: 513 de 513 deputados e 81 de 81 senadores com ao menos uma candidatura; 251 dos 594
  parlamentares em exercício com candidatura ao Congresso em 2010 ou 2014 (187 candidaturas em 2010, 248 em 2014).
