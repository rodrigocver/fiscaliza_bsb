---
titulo: "Avisar quando a ingestão diária falhar"
rotulos: ["infra", "ingestão", "ajuda bem-vinda"]
status: feito
---
## Contexto
Se uma fonte oficial muda de formato, a ingestão falha e o site segue com dados velhos. Hoje isso só aparece na
página `/status` e no log do GitHub Actions; ninguém é avisado.

## O que fazer
- No workflow `.github/workflows/ingestao.yml`, quando o passo "Ingerir" falhar, abrir (ou comentar numa issue já
  aberta) uma issue "Ingestão falhou: tarefa X" com o erro resumido de `ingestao_log` e o link da execução.
- Fechar a issue automaticamente quando a ingestão seguinte passar.
- Evitar spam: no máximo uma issue aberta por tarefa.

## Pronto quando
- Simulada uma falha (ex.: URL inválida num ramo de teste), a issue aparece; no sucesso seguinte, ela fecha.
