# Painel RH · Cury Vendas

App em Next.js 14 (Pages Router) + Supabase para gestão de unidades, vagas, leads, candidatos, entrevistas e relatórios de recrutamento. Acesso único do RH, protegido pela senha do painel. Não há hierarquia, login individual nem cadastro de gestores.

## Variáveis de ambiente (configurar na Vercel)

Veja `.env.example`. Em Project Settings → Environment Variables, adicionar as chaves para "Production" (e "Preview", se quiser testar branches).

## Banco de dados

1. Criar o projeto Supabase da Cury Vendas.
2. Rodar `schema.sql` no SQL Editor (cria tipos, tabelas, índices e ativa Row Level Security).
3. Rodar `seed-cury-rio.sql` (unidade Rio de Janeiro e a vaga Corretor de Imóveis MCMV - Rio de Janeiro).

Row Level Security está ativo em todas as tabelas, sem policies. Só a chave `secret` (usada no backend, nunca no navegador) lê e escreve.

## Rotas públicas (sem login)

- `/p/candidatura/[vagaId]`: formulário de candidatura e agendamento da entrevista (link enviado ao candidato).
- `/p/candidatura/geral`: candidatura geral, sem vaga pré-definida.
- `/p/reagendar/[token]`: reagendamento pelo próprio candidato.

## Integração com Google

Google Agenda e Meet são conectados em `/app/integracoes`, com a conta Google que receberá as entrevistas.
