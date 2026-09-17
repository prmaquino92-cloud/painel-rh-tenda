-- Painel RH Tenda — schema inicial (rodar uma vez no SQL Editor do Supabase)
create extension if not exists "pgcrypto";

do $$ begin
  create type papel_hierarquia as enum ('coordenador','supervisor','gerente_comercial','corretor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_pessoa as enum ('ativo','convite_pendente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_vaga as enum ('ativa','encerrada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_candidato as enum ('inscrito','entrevista_agendada','entrevistado','aprovado','contratado','declinado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_link as enum ('gestor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_link as enum ('pendente','preenchido');
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

create table if not exists pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  telefone text,
  papel papel_hierarquia not null,
  superior_id uuid references pessoas(id) on delete set null,
  unidade_id uuid references unidades(id) on delete set null,
  status status_pessoa not null default 'ativo',
  criado_em timestamptz not null default now()
);

create table if not exists vagas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  area text,
  descricao text,
  unidade_id uuid references unidades(id) on delete set null,
  gerente_id uuid references pessoas(id) on delete set null,
  status status_vaga not null default 'ativa',
  campos jsonb not null default '{"idade":true,"localizacao":true,"telefone":true,"email":true,"redes":true,"curriculo":true}',
  agenda jsonb not null default '{"diasSemana":[1,2,3,4,5],"inicio":"09:00","fim":"17:30","duracaoMin":30}',
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
  pessoa_id uuid references pessoas(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists entrevistas (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid references candidatos(id) on delete cascade,
  vaga_id uuid references vagas(id) on delete set null,
  data date not null,
  hora time not null,
  google_event_id text,
  meet_link text,
  status text not null default 'agendada',
  criado_em timestamptz not null default now()
);

create table if not exists links_convite (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_link not null default 'gestor',
  papel papel_hierarquia not null,
  unidade_id uuid references unidades(id) on delete set null,
  superior_id uuid references pessoas(id) on delete set null,
  token text not null unique,
  status status_link not null default 'pendente',
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

create index if not exists idx_pessoas_superior on pessoas(superior_id);
create index if not exists idx_pessoas_unidade on pessoas(unidade_id);
create index if not exists idx_vagas_unidade on vagas(unidade_id);
create index if not exists idx_candidatos_vaga on candidatos(vaga_id);
create index if not exists idx_entrevistas_candidato on entrevistas(candidato_id);
create index if not exists idx_links_token on links_convite(token);

-- protege as tabelas: só o backend (chave secreta) acessa, nunca o navegador
alter table unidades enable row level security;
alter table pessoas enable row level security;
alter table vagas enable row level security;
alter table candidatos enable row level security;
alter table entrevistas enable row level security;
alter table links_convite enable row level security;
alter table bloqueios enable row level security;
alter table google_tokens enable row level security;
