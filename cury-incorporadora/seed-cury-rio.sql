-- Cadastro inicial da Cury Vendas: unidade Rio de Janeiro e a única vaga da operação.
-- Pode rodar mais de uma vez sem duplicar (cada insert verifica se já existe).
-- Rodar depois de schema.sql.

insert into unidades (nome, cidade, estado)
select 'Rio de Janeiro', 'Rio de Janeiro', 'RJ'
where not exists (select 1 from unidades where nome = 'Rio de Janeiro');

insert into vagas (titulo, area, descricao, unidade_id, status)
select
  'Corretor de Imóveis MCMV - Rio de Janeiro',
  'Corretor de Imóveis',
  'Corretor de imóveis para empreendimentos do programa Minha Casa Minha Vida, no Rio de Janeiro.',
  (select id from unidades where nome = 'Rio de Janeiro' limit 1),
  'ativa'
where not exists (select 1 from vagas where titulo = 'Corretor de Imóveis MCMV - Rio de Janeiro');
