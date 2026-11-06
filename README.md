# Painel RH · Tenda Vendas

App em Next.js 14 (Pages Router) + Supabase, para gestão de hierarquia, unidades, vagas, candidatos e entrevistas.

## Variáveis de ambiente (configurar no Vercel)

Veja `.env.example`. Na Vercel: Project Settings → Environment Variables, adicionar as 4 chaves para "Production" (e "Preview"/"Development" se quiser testar branches).

## Banco de dados

O schema já foi criado no Supabase via SQL Editor (`schema.sql`). Row Level Security está ativo em todas as tabelas, sem policies — só a chave `secret` (usada no backend, nunca no navegador) consegue ler/escrever.

## Rotas públicas (sem login)

- `/p/candidatura/[vagaId]` — formulário de candidatura + agendamento de entrevista (link enviado ao candidato).
- `/p/cadastro-gestor/[token]` — cadastro de gestor a partir de um link de convite gerado no painel.

## Próxima etapa (não incluída nesta versão)

Integração real com Google Calendar/Meet (hoje o app apenas registra a entrevista no banco; a criação automática do evento/Meet fica documentada em `/app/integracoes`).
