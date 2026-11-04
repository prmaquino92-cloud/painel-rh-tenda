-- Painel RH Cury Vendas — schema completo (rodar uma vez no SQL Editor do Supabase, projeto novo).
-- Baseado no schema de produção da operação anterior, sem a parte de hierarquia (pessoas,
-- links de convite, papéis, gerente por vaga/entrevista, feedback de gerente) e sem as tabelas
-- de backup. Nada aqui depende de dados de outra empresa.
create extension if not exists "pgcrypto";

do $$ begin
  create type status_vaga as enum ('ativa','encerrada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_candidato as enum (
    'inscrito','entrevista_agendada','entrevistado','aguardando_agenda_2a',
    'segunda_entrevista_agendada','aguardando_rh','aguardando_candidato',
    'aprovado','contratado','declinado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_lead as enum ('novo','em_tratamento','sem_contato','declinado','convertido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type origem_candidato as enum (
    'abordagem_ativa','indicacao','meta_whatsapp','outro','pandape','site'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_bloqueio as enum ('recorrente','pontual');
exception when duplicate_object then null; end $$;

create table if not exists unidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  estado text,
  endereco text,
  criado_em timestamptz not null default now()
);

create table if not exists vagas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  area text,
  descricao text,
  unidade_id uuid references unidades(id) on delete set null,
  status status_vaga not null default 'ativa',
  campos jsonb not null default '{"idade":true,"localizacao":true,"telefone":true,"email":true,"redes":true,"curriculo":true}',
  agenda jsonb not null default '{"diasSemana":[1,2,3,4,5],"inicio":"09:00","fim":"17:30","duracaoMin":30}',
  criado_em timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text,
  localidade text,
  vaga_id uuid references vagas(id) on delete set null,
  status status_lead not null default 'novo',
  token text unique,
  origem origem_candidato not null default 'outro',
  criado_em timestamptz not null default now()
);

create table if not exists lead_eventos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  tipo text not null,
  status_anterior text,
  status_novo text,
  observacao text,
  criado_em timestamptz not null default now()
);

create table if not exists candidatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  idade int,
  cidade text,
  estado text,
  cep text,
  telefone text,
  email text,
  linkedin text,
  instagram text,
  facebook text,
  curriculo_url text,
  vaga_id uuid references vagas(id) on delete set null,
  status status_candidato not null default 'inscrito',
  lead_id uuid references leads(id) on delete set null,
  parecer text,
  origem origem_candidato not null default 'site',
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create table if not exists candidato_eventos (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid not null references candidatos(id) on delete cascade,
  tipo text not null,
  status_anterior text,
  status_novo text,
  observacao text,
  criado_em timestamptz not null default now()
);

create table if not exists entrevistas (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid references candidatos(id) on delete cascade,
  vaga_id uuid references vagas(id) on delete set null,
  unidade_id uuid references unidades(id) on delete set null,
  data date not null,
  hora time not null,
  google_event_id text,
  meet_link text,
  meet_erro text,
  status text not null default 'agendada',
  tipo text not null default 'meet',
  rodada int not null default 1,
  reagendamento_token text,
  criado_em timestamptz not null default now()
);

create table if not exists bloqueios (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_bloqueio not null,
  dia_semana int,
  data date,
  inicio time not null,
  fim time not null,
  motivo text,
  criado_em timestamptz not null default now()
);

create table if not exists google_tokens (
  id int primary key default 1,
  refresh_token text,
  access_token text,
  access_token_expiry timestamptz,
  connected_email text,
  updated_em timestamptz not null default now()
);

create index if not exists idx_candidatos_vaga on candidatos(vaga_id);
create index if not exists idx_candidatos_lead on candidatos(lead_id);
create index if not exists idx_candidato_eventos_candidato on candidato_eventos(candidato_id);
create index if not exists idx_entrevistas_candidato on entrevistas(candidato_id);
create index if not exists idx_entrevistas_reagendamento on entrevistas(reagendamento_token);
create index if not exists idx_vagas_unidade on vagas(unidade_id);
create index if not exists idx_leads_vaga on leads(vaga_id);
create index if not exists idx_leads_token on leads(token);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_lead_eventos_lead on lead_eventos(lead_id);
create index if not exists idx_lead_eventos_criado on lead_eventos(criado_em);

-- protege as tabelas: só o backend (chave secreta) acessa, nunca o navegador
alter table unidades enable row level security;
alter table vagas enable row level security;
alter table leads enable row level security;
alter table lead_eventos enable row level security;
alter table candidatos enable row level security;
alter table candidato_eventos enable row level security;
alter table entrevistas enable row level security;
alter table bloqueios enable row level security;
alter table google_tokens enable row level security;
