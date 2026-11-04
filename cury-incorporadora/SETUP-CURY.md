# Painel RH · Cury Vendas: situação e passo a passo

Réplica do painel de recrutamento com a identidade visual da Cury Vendas (logo, azul #3212FF, tipografia Inter). Nenhum dado de candidato de outra operação foi copiado.

## O que mudou em relação à operação anterior

- Schema reconciliado: `schema.sql` agora reflete o banco de produção (colunas e tabelas de `entrevistas`, `candidatos`, `candidato_eventos`, `leads`, `lead_eventos`, `bloqueios`, `google_tokens`), sem as tabelas de hierarquia (`pessoas`, `links_convite`) e sem as tabelas de backup.
- Hierarquia removida: sem coordenadores, supervisores, gerentes, gestores por vaga, cadastro de gestor, login individual e visão por equipe. Há um único acesso, o do RH, com a senha do painel.
- Segunda entrevista mantida: continua como etapa presencial marcada pelo RH, com data, horário e unidade. O condutor dessa entrevista ainda não foi definido, então nenhum responsável é associado a ela. O link de feedback do gerente foi removido; o parecer e a decisão (aprovar ou reprovar) ficam com o RH.
- Contratação: "Confirmar contratação" apenas muda o status do candidato para "contratado", sem criar equipe.
- Relatórios: a planilha não tem mais a aba por equipe nem a de turnover.

## Pendências antes da implantação

1. Definir quem conduz a 2ª entrevista da Cury, quando tiver os dados dessa pessoa.
2. Revisar os textos de abordagem por WhatsApp e e-mail (sem prazos nem percentuais, conforme pedido).
3. A checagem feita nesta versão foi sintática e de imports (esbuild). Não foi possível rodar `npm install` nem `next build`, porque o registro do npm está bloqueado neste ambiente. Rodar `npm install && npm run build` localmente ou na Vercel antes de liberar.

## Passo a passo de implantação

1. Supabase: criar projeto novo, rodar `schema.sql` e depois `seed-cury-rio.sql`.
2. Variáveis: preencher as chaves de `.env.example` (Supabase, `PANEL_PASSWORD`, `SESSION_SECRET`, Google).
3. Google Cloud da Cury: projeto próprio, Google Calendar API, tela de consentimento OAuth, cliente Web com redirect `https://<dominio>/api/google/callback`.
4. Deploy: repositório no GitHub e projeto na Vercel com as variáveis; associar o domínio.
5. Página da MA Gestão: colocar a URL da Cury Vendas em `lib/empresas.js` do projeto `ma-gestao-hub`.

## Ativos visuais

- `public/logo-empresa.png` e `public/icons/*`: derivados da logo enviada (quadrado azul com CURY VENDAS).
