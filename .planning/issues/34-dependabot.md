---
titulo: "Atualizações automáticas de dependências (Dependabot)"
rotulos: ["boa primeira issue", "infra"]
status: feito
---
## Contexto
Não há `.github/dependabot.yml`. Next.js, Auth.js e as Actions recebem correções de segurança com frequência e
ninguém é avisado.

## O que fazer
- `.github/dependabot.yml` para `npm` e `github-actions`, semanal, agrupando atualizações menores num único PR.
- Ignorar saltos de versão maior de `next`, `react` e `drizzle-orm` (exigem revisão manual); registrar o motivo
  no próprio arquivo.
- Uma linha no `CONTRIBUTING.md` explicando como revisar esses PRs (o CI roda os testes de ponta a ponta).

## Pronto quando
- O Dependabot abre o primeiro PR agrupado e o CI roda nele.
