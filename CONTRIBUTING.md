# Como contribuir

Obrigado por ajudar! O Fiscaliza existe para que qualquer eleitor acompanhe, com dados oficiais,
o que fazem os parlamentares que elegeu. Toda contribuição conta: código, correção de dados,
texto, design, testes ou um relato de número que não bate com a fonte.

## Princípios do projeto

Valem para qualquer mudança. Pull requests que os contrariem não serão aceitos.

1. **Só dados públicos oficiais.** Toda informação vem da Câmara, do Senado ou de outro órgão público,
   e o site mostra a fonte e a data de atualização.
2. **Neutralidade.** Mostramos fatos e métricas, nunca adjetivos, rankings de "melhores/piores" ou
   juízo de valor. O mesmo cálculo vale para todos os parlamentares, de qualquer partido.
3. **Toda métrica explica como é calculada.** Número novo na tela vem com o bloco "Como calculamos"
   e com a definição em [docs/METRICAS.md](docs/METRICAS.md).
4. **O site não consulta APIs do governo em tempo real.** Os dados são copiados para o nosso banco
   pelas tarefas de ingestão; as páginas leem só do banco.
5. **Privacidade (LGPD).** Do usuário guardamos só o e-mail e a lista que ele acompanha. Nada de
   rastreamento de terceiros.

## Por onde começar

- Veja as issues com o rótulo **`boa primeira issue`**: são tarefas pequenas e bem delimitadas.
- A lista completa de tarefas planejadas, com escopo e critério de pronto, está em
  [.planning/BACKLOG.md](.planning/BACKLOG.md).
- Achou um número diferente do portal oficial? Abra uma issue **"Dado divergente"**. É uma das
  contribuições mais úteis.
- Para mudanças grandes (nova fonte de dados, nova métrica, mudança de banco), abra uma issue para
  discutir **antes** de escrever o código.

## Ambiente local

**Mais fácil: no navegador.** Abra o projeto no [GitHub Codespaces](https://codespaces.new/rodrigocver/fiscaliza_bsb):
o ambiente vem com banco, dependências e dados de exemplo; é só rodar `npm run dev`. Passo a passo em
[docs/PRIMEIRA-CONTRIBUICAO.md](docs/PRIMEIRA-CONTRIBUICAO.md). A mesma configuração (`.devcontainer/`) funciona
no VS Code com a extensão Dev Containers.

**No seu computador:** Node 22+ e Docker (ou um Postgres 16 instalado). Nenhuma conta externa é necessária.

```bash
git clone <seu-fork>
cd <pasta>
npm install
docker compose up -d            # Postgres local
cp .env.example .env            # no Windows (PowerShell): Copy-Item .env.example .env
npm run exemplo                 # dados de exemplo em segundos (o mesmo cenário dos testes)
npm run dev                     # http://localhost:3000
```

- **Dados reais:** `npm run ingest` (ano corrente, ~3 min) ou `npm run ingest -- --desde 2023` (legislatura,
  ~20 min). `npm run exemplo -- --forcar` volta aos dados de exemplo.

- Para a legislatura inteira: `npm run ingest -- --desde 2023` (~10 min).
- **Login local:** o link de acesso aparece no terminal do `npm run dev`.
- **E-mails locais:** `npm run resumo-mensal` grava os e-mails em `.emails/` em vez de enviar.
- Não rode `npm run dev` junto com `npm run build` ou `npm start`: os dois usam a pasta `.next` e o build
  sai corrompido. Pare um antes de iniciar o outro.
- A Câmara regenera os arquivos em lote de madrugada; se a ingestão falhar com JSON inválido
  nesse horário, rode de novo mais tarde.

## Fluxo de trabalho

1. Faça um fork e crie uma branch a partir de `main`: `git checkout -b corrige-presenca-suplentes`.
2. Faça a mudança com testes (veja abaixo).
3. Rode as verificações (o CI roda as mesmas):
   ```bash
   npm run format && npm run verificar && npm run build
   ```
4. Abra o pull request preenchendo o modelo. Se mexeu na tela, inclua um print no celular.
5. Um mantenedor revisa. Pedidos de ajuste são normais; responda nos comentários.

**PRs do Dependabot** (`.github/dependabot.yml`, toda segunda): se o CI passou, inclusive os testes de ponta a ponta,
leia as notas de versão dos pacotes com mudança de comportamento e faça o merge. Versões maiores de Next.js, React
e Drizzle ficam de fora e são atualizadas à mão.

### Mensagens de commit

Seguimos [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em português:

```
feat: filtro por tema na aba de votações
fix: presença de suplentes considera período de exercício
docs: explica cálculo do alinhamento no Senado
```

Tipos usados: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `perf`.

## Convenções de código

- **Nomes em português** (variáveis, funções, tabelas), como no restante do código. Termos técnicos
  consagrados podem ficar em inglês (`schema`, `handler`).
- **TypeScript estrito**, formatação pelo Prettier (`npm run format`, 120 colunas).
- **Ingestão:** separe a conversão dos dados (funções puras, ex.: `mapDespesas`) da gravação no
  banco, e teste as funções puras com exemplos reais da fonte. Ingestões precisam poder rodar
  várias vezes sem duplicar dados.
- **Banco:** mude `src/db/schema.ts` e gere a migração com `npm run db:generate`. Nunca edite
  migrações já publicadas.
- **Consultas e métricas:** ficam em `src/lib/consultas.ts`. Se a métrica também aparece nas médias,
  atualize `src/ingest/estatisticas.ts` com a mesma definição.
- **Escala:** páginas públicas são estáticas e servidas da CDN (milhões de acessos sem chegar ao banco). Nelas,
  não use `auth()`, `cookies()`, `headers()` nem `searchParams`: filtros vão no caminho (`src/lib/caminhos.ts`) e o
  que é pessoal é montado no navegador a partir de `/api/eu` (`src/components/conta.ts`). `npm run conferir:cache`,
  depois do build, acusa uma página que virou dinâmica. Detalhes em [docs/ESCALA.md](docs/ESCALA.md).
- **Interface:** mobile first, cores pelos tokens de `globals.css` (funciona no tema escuro),
  sem bibliotecas de gráficos pesadas.
- **Acessibilidade:** gráficos têm alternativa em texto (`BarrasMensais` recebe `titulo` e gera tabela para
  leitores de tela; barras decorativas levam `aria-hidden`). Áreas com rolagem horizontal precisam ser focáveis.
  Antes do PR, rode o Lighthouse (Acessibilidade) ou a extensão axe DevTools nas páginas que mudou: hoje o
  site tem nota 100 e nenhum problema no axe, nos temas claro e escuro.

## Testes

- `npm test` roda os testes unitários (Vitest), em `tests/`.
- `npm run test:integracao` roda os testes com Postgres real, em `tests/integracao/`, num banco separado
  (`fiscaliza_teste`, criado pelo `docker compose up -d`). Eles **apagam os dados** desse banco; por segurança
  só rodam em bancos cujo nome termina em `_teste`. Mudou uma métrica? Ajuste o cenário em
  `tests/integracao/dados.ts` e os valores esperados.
- `npm run test:e2e` abre o site no navegador (Playwright, tela de celular): prepara o mesmo banco de teste, faz o
  build **com ele** e testa todas as páginas, com o axe em cada uma, a busca, os redirecionamentos, o CSV e o fluxo
  de quem está logado. Como o build fica com os dados de teste, rode `npm run build` de novo antes de voltar a usar
  `npm start` com o seu banco. No primeiro uso: `npx playwright install chromium`. Página nova? Inclua em
  `tests/e2e/paginas.spec.ts`.
- Toda função de conversão de dados novos precisa de teste com um exemplo real da fonte.
- Correção de bug: inclua um teste que falhava antes da correção.

## Estrutura e arquitetura

Visão geral em [docs/ARQUITETURA.md](docs/ARQUITETURA.md). Fontes de dados e suas peculiaridades
em [docs/FONTES.md](docs/FONTES.md). Definição de cada métrica em [docs/METRICAS.md](docs/METRICAS.md).

## Conduta

Este projeto segue o [Código de Conduta](CODE_OF_CONDUCT.md). Discussões sobre política partidária
ficam fora das issues e pull requests: aqui discutimos dados, código e método.

## Licença

Ao contribuir, você concorda que sua contribuição será licenciada sob a [licença MIT](LICENSE).
