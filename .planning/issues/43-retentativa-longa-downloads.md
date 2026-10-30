---
titulo: "Ingestão: esperar mais entre tentativas nos downloads grandes"
rotulos: ["infra", "ingestão", "boa primeira issue"]
---
## Contexto
Quedas curtas das fontes oficiais derrubam a ingestão diária. Na execução de 29/10/2026, `camara:despesas` falhou porque
`www.camara.leg.br/cotas/Ano-2026.csv.zip` não aceitou conexão (`ConnectTimeoutError`, 10 s em cada um dos três IPs). Em
27/10/2026, o Senado respondeu HTTP 503 em `senado:proposicoes` e `senado:comissoes`. O dia seguinte passou sem mudança
nenhuma, o que indica falha passageira da fonte.

Hoje `fetchComRetry` (`src/ingest/http.ts`) faz 4 tentativas com espera de 2, 4 e 8 s. A janela total fica perto de um
minuto, curta para um servidor que volta em alguns minutos.

## O que fazer
- Em `baixarArquivo` (`src/ingest/util.ts`), passar a `fetchComRetry` uma espera em escala de minutos (ex.: 30 s, 2 min,
  5 min). Para isso, aceitar em `fetchComRetry` uma opção de espera base, mantendo o padrão atual para as chamadas de API.
- Avaliar o mesmo para as chamadas do Senado que devolvem 503.
- Registrar no log cada nova tentativa (tarefa, URL, motivo) para a queda aparecer mesmo quando a tentativa seguinte passa.
- Anotar o comportamento em `docs/FONTES.md`.

## Pronto quando
- Teste de unidade com `fetch` simulado: falha de conexão nas duas primeiras chamadas e sucesso na terceira devolve o
  arquivo, com as esperas configuradas (timers falsos).
- As chamadas de API continuam com a espera curta de hoje.

Só vale priorizar se as falhas passarem de umas duas por semana; a gravação é idempotente e a execução seguinte recupera
os dados.
