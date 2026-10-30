# Arquitetura

```
 Fontes oficiais                 Ingestão (agendada)               Banco (Postgres)          Site (Next.js)
 ─────────────────               ───────────────────               ────────────────          ──────────────
 Câmara: arquivos anuais  ──►  src/ingest/camara.ts        ──►                       ──►  src/app/ (páginas)
 Câmara: API v2           ──►  src/ingest/parlamentares.ts ──►   parlamentar, sessao,  ──►  src/lib/consultas.ts
 Senado: API dadosabertos ──►  src/ingest/senado.ts        ──►   presenca, votacao,    
 Senado: API CEAPS        ──►                                     voto, orientacao,     ──►  Resumo mensal
                               src/ingest/estatisticas.ts  ──►   proposicao, autoria,       scripts/resumo-mensal.ts
                               (médias e alinhamento)            despesa, estatistica       src/emails/
```

## Decisões principais

| Decisão | Motivo |
|---|---|
| Ingestão em lote para banco próprio; o site nunca chama as APIs do governo | As APIs são lentas, caem e mudam sem aviso (ver [FONTES.md](FONTES.md)) |
| Modelo único para as duas casas, com coluna `casa` (`CD`/`SF`) | Mesma tela e mesmas consultas para deputados e senadores |
| Funções puras de conversão separadas da gravação | Testáveis com exemplos reais das fontes, sem banco |
| Ingestões idempotentes (upsert, ou apagar e regravar o ano) | Podem rodar quantas vezes for preciso; as fontes corrigem dados retroativamente |
| Tabela `estatistica` pré-calculada | Médias da casa e do partido sem varrer milhões de linhas por página |
| Next.js App Router com Server Components | Páginas renderizadas no servidor, leves no celular, sem API intermediária |
| Páginas públicas estáticas (ISR) com filtros no caminho; parte pessoal montada no navegador (`/api/eu`) | Milhões de acessos servidos pela CDN sem chegar ao banco ([ESCALA.md](ESCALA.md)) |
| Busca no navegador sobre `/indice-busca.json` | Nenhuma busca chega ao servidor |
| Auth.js + Drizzle | Login sem depender de um provedor específico; roda com qualquer Postgres |
| Service worker próprio (`public/sw.js`), sem biblioteca | Offline básico para perfis já vistos e para a busca; nunca guarda páginas pessoais |
| Gráficos em CSS puro | Leve e legível no celular; sem dependência de biblioteca de gráficos |

## Pastas

| Caminho | Conteúdo |
|---|---|
| `src/db/schema.ts` | Tabelas (Drizzle). Migrações geradas em `drizzle/` |
| `src/ingest/` | Ingestão por fonte; `util.ts` e `http.ts` cuidam de downloads com retentativa |
| `src/lib/consultas.ts` | Todas as consultas das páginas e definições das métricas |
| `src/lib/periodo.ts` | Períodos (ano, legislatura, mês) |
| `src/app/` | Páginas, ações de servidor (`acoes.ts`) e rotas de API |
| `src/components/` | Componentes de interface |
| `src/emails/` | Template do resumo mensal |
| `scripts/` | CLIs: `ingest.ts`, `resumo-mensal.ts`, `criar-issues.sh` |
| `tests/` | Testes unitários (Vitest) |
| `.github/workflows/` | CI, ingestão diária, resumo mensal |
| `.planning/` | Planejamento: visão, requisitos, roadmap, backlog |

## Tarefas de ingestão

`npm run ingest -- [tarefa...] [--desde ANO]`, nesta ordem:

| Tarefa | O que faz |
|---|---|
| `deputados`, `senadores` | Cadastro (marca quem está em exercício) |
| `camara:exercicio`, `senado:exercicio` | Períodos em exercício (licenças, suplências) |
| `camara:presencas` | Sessões deliberativas e presença |
| `camara:votacoes` | Votações nominais de plenário, votos e orientações |
| `camara:proposicoes` | Proposições de autoria de deputados |
| `camara:despesas` | Cota parlamentar (CEAP) |
| `senado:votacoes` | Votações nominais, votos, orientações e comparecimento |
| `senado:proposicoes` | Proposições de autoria de senadores |
| `senado:despesas` | Cota parlamentar (CEAPS) |
| `camara:comissoes`, `senado:comissoes` | Órgãos e membros das comissões |
| `camara:reunioes` | Reuniões deliberativas de comissão e presença (por ano) |
| `senado:relatorias` | Relatorias de projetos (por ano) |
| `temas` | Temas oficiais das matérias votadas (incremental) |
| `tse` | Candidaturas, bens declarados e receitas de campanha (eleições de 2010 em diante). Só na carga completa (`--desde`) ou pedida pelo nome |
| `estatisticas` | Recalcula a visão `janela_exercicio` e a tabela `estatistica` (sempre por último) |

Cada execução é registrada em `ingestao_log`; o rodapé do site mostra a última atualização bem-sucedida.
No GitHub Actions, o último passo do workflow (`scripts/alertar-ingestao.ts`) abre uma issue "Ingestão falhou: <tarefa>"
para cada tarefa com erro, comenta nela se a falha se repete e a fecha quando a tarefa volta a passar.
